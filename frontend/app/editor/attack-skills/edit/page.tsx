import { Suspense } from "react";
import ClientPage from "./ClientPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="page-shell flex items-center justify-center text-gray-600">
          加载中...
        </div>
      }
    >
      <ClientPage />
    </Suspense>
  );
}
