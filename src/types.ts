/** A subscription CanvasEngine holds for the tick stream. */
export type SubscriptionLike = {
  unsubscribe: () => void
}

/** The part of CanvasEngine's `GlobalAssetLoader` that sprite teardown touches. */
export type GlobalAssetLoaderLike = {
  removeAsset?: (assetId: string) => void
}

/** The Pixi transform points a sprite animation writes through. Pixi nulls them on destroy. */
export type SpriteAnimationLifecycleInstance = {
  destroyed?: boolean
  anchor?: { set?: (...args: number[]) => void } | null
  scale?: { set?: (...args: number[]) => void } | null
  skew?: { set?: (...args: number[]) => void } | null
  pivot?: { set?: (...args: number[]) => void } | null
}

export type SpriteLifecycleInstance = {
  globalLoader?: GlobalAssetLoaderLike | null
  trackedAssetIds?: Set<string>
  subscriptionTick?: SubscriptionLike
}

/** The registered CanvasEngine sprite component class, seen through the members the patches wrap. */
export type SpriteComponentConstructor = {
  prototype: {
    onDestroy: (parent: unknown, afterDestroy: () => void) => Promise<void>
    play: (animation: string, params?: unknown[]) => void
    update: (tick: { deltaRatio?: number }) => void
  }
}

export type ViewportLifecycleInstance = {
  tickSubscription?: SubscriptionLike
}

export type ViewportSettings = {
  clamp?: unknown
  [key: string]: unknown
}

/** The registered CanvasEngine viewport component class, seen through the members the patches wrap. */
export type ViewportComponentConstructor = {
  prototype: {
    updateViewportSettings: (props: ViewportSettings) => void
    onDestroy: (parent: unknown, afterDestroy: () => void) => Promise<void>
  }
}
