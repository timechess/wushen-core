"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ActivePackStatus from "@/components/mod/ActivePackStatus";
import { useActivePack } from "@/lib/mods/active-pack";
import { exportPackZip, importPackZip } from "@/lib/tauri/commands";
import { open, save } from "@tauri-apps/plugin-dialog";

export default function DataToolsPage() {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const { activePack, setActivePack } = useActivePack();

  const openExportDialog = async () => {
    if (!activePack) {
      setNotice({ title: "未选择模组包", message: "请先选择模组包后再导出。" });
      return;
    }
    const suggestedName = `${activePack.name || "wushen-pack"}-${activePack.version || "0.1.0"}.zip`;
    try {
      const targetPath = await save({
        defaultPath: suggestedName,
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
      if (!targetPath) {
        return;
      }
      setLoading(true);
      const resultPath = await exportPackZip(activePack.id, targetPath);
      setNotice({ title: "导出完成", message: `已导出到：${resultPath}` });
    } catch (error) {
      console.error("导出失败:", error);
      setNotice({ title: "导出失败", message: "导出失败，请稍后重试。" });
    } finally {
      setLoading(false);
    }
  };

  const openImportDialog = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
      if (!selected) {
        return;
      }
      const zipPath = Array.isArray(selected) ? selected[0] : selected;
      if (!zipPath) return;
      setLoading(true);
      const pack = await importPackZip(zipPath);
      setActivePack({
        id: pack.id,
        name: pack.name,
        version: pack.version,
        author: pack.author,
      });
      setNotice({ title: "导入成功", message: "已更新模组包。" });
    } catch (error) {
      console.error("导入失败:", error);
      setNotice({ title: "导入失败", message: "导入失败，请检查文件格式。" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <ActivePackStatus message="导出当前包，或导入一个新的模组包。" />
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            模组包导入/导出
          </h1>

          <div className="space-y-6">
            <div className="p-4 border border-gray-200 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">导出数据包</h2>
              <p className="text-sm text-gray-600 mb-4">
                导出当前模组包为 ZIP 文件（包含 metadata.toml 与各数据文件）。
              </p>
              <Button
                onClick={openExportDialog}
                disabled={loading || !activePack}
              >
                导出当前模组包
              </Button>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">导入数据包</h2>
              <p className="text-sm text-gray-600 mb-4">
                导入 ZIP 文件将创建或覆盖同 ID 的模组包。
              </p>
              <Button onClick={openImportDialog} disabled={loading}>
                选择 ZIP 导入
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={Boolean(notice)}
        onClose={() => setNotice(null)}
        title={notice?.title ?? "提示"}
        footer={
          <div className="flex gap-2">
            <Button onClick={() => setNotice(null)}>知道了</Button>
          </div>
        }
      >
        <div className="text-sm text-gray-600">{notice?.message}</div>
      </Modal>
    </div>
  );
}
