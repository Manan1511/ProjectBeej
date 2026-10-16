export type ProductCardCartState = {
  quantity: number;
  lineId: string | null;
  busy: boolean;
};

export type ProductCardCartLine = {
  id: string;
  quantity: number;
};

export type ProductCardCartAction =
  | { type: "add-start" }
  | { type: "add-queue" }
  | { type: "add-success"; line: ProductCardCartLine | null }
  | { type: "add-failure" }
  | { type: "change-start"; quantity: number }
  | { type: "change-success"; line: ProductCardCartLine | null }
  | { type: "change-failure"; quantity: number };

export const initialProductCardCartState: ProductCardCartState = {
  quantity: 0,
  lineId: null,
  busy: false,
};

export function canQueueAnotherAdd(state: ProductCardCartState): boolean {
  return state.busy && !state.lineId && state.quantity > 0 && state.quantity < 10;
}

export function canIncreaseProductCardQuantity(state: ProductCardCartState): boolean {
  if (state.quantity >= 10) return false;
  return state.busy ? canQueueAnotherAdd(state) : Boolean(state.lineId);
}

export function productCardCartReducer(
  state: ProductCardCartState,
  action: ProductCardCartAction,
): ProductCardCartState {
  switch (action.type) {
    case "add-start":
      return { quantity: 1, lineId: null, busy: true };
    case "add-queue":
      return canQueueAnotherAdd(state)
        ? { ...state, quantity: state.quantity + 1 }
        : state;
    case "add-success":
    case "change-success":
      return {
        quantity: action.line?.quantity || 0,
        lineId: action.line?.id || null,
        busy: false,
      };
    case "add-failure":
      return initialProductCardCartState;
    case "change-start":
      return { ...state, quantity: action.quantity, busy: true };
    case "change-failure":
      return { ...state, quantity: action.quantity, busy: false };
  }
}
