export type SubscriptionLike = {
  unsubscribe: () => void;
};

export type GlobalAssetLoaderLike = {
  removeAsset?: (assetId: string) => void;
};

export type SpriteInstanceWithAnchor = {
  destroyed?: boolean;
  anchor?: {
    set?: (...args: number[]) => void;
  } | null;
};

export type SpriteLifecycleInstance = SpriteInstanceWithAnchor & {
  globalLoader?: GlobalAssetLoaderLike | null;
  trackedAssetIds?: Set<string>;
  subscriptionTick?: SubscriptionLike;
};

export type SpriteComponentConstructor = {
  __arcadeHitboxAnchorPatchInstalled?: boolean;
  __arcadeSafeTeardownPatchInstalled?: boolean;
  __arcadeDeferredAssetCleanupPatchInstalled?: boolean;
  prototype: {
    applyHitboxAnchor: (width: number, height: number, realSize?: unknown) => void;
    onDestroy: (parent: unknown, afterDestroy: () => void) => Promise<void>;
  };
};

export type GraphicsLike = {
  clear: () => void;
  rect: (x: number, y: number, width: number, height: number) => void;
  fill: (style: number | { color: number; alpha?: number }) => void;
};

export type ViewportLike = {
  mask?: GraphicsLike | null;
  viewport?: {
    screenWidth?: number;
    screenHeight?: number;
  } | null;
};

export type ViewportSettings = {
  clamp?: unknown;
  [key: string]: unknown;
};

export type ViewportComponentConstructor = {
  __arcadeMaskPatchInstalled?: boolean;
  __arcadeClampPatchInstalled?: boolean;
  prototype: {
    updateMask: () => void;
    updateViewportSettings: (props: ViewportSettings) => void;
  };
};
