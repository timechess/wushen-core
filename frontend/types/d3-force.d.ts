declare module 'd3-force' {
  export interface Simulation<T> {
    force(name: string, force: Force<T> | null): this;
    stop(): this;
    tick(): this;
  }

  export interface Force<T> {
    (alpha: number): void;
    initialize?(nodes: T[]): void;
  }

  export interface ForceLink<TNode, TLink> extends Force<TNode> {
    id(accessor: (node: TNode) => string): this;
    distance(distance: number): this;
  }

  export interface ForceManyBody<TNode> extends Force<TNode> {
    strength(value: number): this;
  }

  export interface ForceCollide<TNode> extends Force<TNode> {
    radius(radius: number): this;
  }

  export interface ForceCenter<TNode> extends Force<TNode> {}

  export function forceSimulation<T>(nodes?: T[]): Simulation<T>;
  export function forceLink<TNode, TLink>(links: TLink[]): ForceLink<TNode, TLink>;
  export function forceManyBody<TNode>(): ForceManyBody<TNode>;
  export function forceCenter<TNode>(x: number, y: number): ForceCenter<TNode>;
  export function forceCollide<TNode>(radius: number): ForceCollide<TNode>;
}
