export type SubscriptionLike = {
  unsubscribe: () => void;
};

export type GlobalAssetLoaderLike = {
  removeAsset?: (assetId: string) => void;
};

export type SpriteAnimationLifecycleInstance = {
  destroyed?: boolean;
  anchor?: {
    set?: (...args: number[]) => void;
  } | null;
  scale?: { set?: (...args: number[]) => void } | null;
  skew?: { set?: (...args: number[]) => void } | null;
  pivot?: { set?: (...args: number[]) => void } | null;
};

export type SpriteLifecycleInstance = {
  globalLoader?: GlobalAssetLoaderLike | null;
  trackedAssetIds?: Set<string>;
  subscriptionTick?: SubscriptionLike;
};

export type SpriteComponentConstructor = {
  __arcadeSafeTeardownPatchInstalled?: boolean;
  __arcadeDeferredAssetCleanupPatchInstalled?: boolean;
  __arcadeAnimationLifecyclePatchInstalled?: boolean;
  prototype: {
    onDestroy: (parent: unknown, afterDestroy: () => void) => Promise<void>;
    play: (animation: string, params?: unknown[]) => void;
    update: (tick: { deltaRatio?: number }) => void;
  };
};

export type ViewportLifecycleInstance = {
  tickSubscription?: SubscriptionLike;
};

export type ViewportSettings = {
  clamp?: unknown;
  [key: string]: unknown;
};

export type ViewportComponentConstructor = {
  __arcadeClampPatchInstalled?: boolean;
  __arcadeSafeTeardownPatchInstalled?: boolean;
  prototype: {
    updateViewportSettings: (props: ViewportSettings) => void;
    onDestroy: (parent: unknown, afterDestroy: () => void) => Promise<void>;
  };
};
