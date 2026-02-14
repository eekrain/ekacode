import type { ProviderClient } from "@/core/services/api/provider-client";
import {
  createProviderSelectionStore,
  type ProviderSelectionStore,
} from "@/core/state/providers/provider-selection-store";
import { createContext, useContext, type JSX, type ParentComponent } from "solid-js";

const ProviderSelectionContext = createContext<ProviderSelectionStore>();

interface ProviderSelectionProviderProps {
  client: ProviderClient;
  children: JSX.Element;
}

export const ProviderSelectionProvider: ParentComponent<ProviderSelectionProviderProps> = props => {
  const store = createProviderSelectionStore(props.client);
  return (
    <ProviderSelectionContext.Provider value={store}>
      {props.children}
    </ProviderSelectionContext.Provider>
  );
};

export function useProviderSelectionStore(): ProviderSelectionStore {
  const store = useContext(ProviderSelectionContext);
  if (!store) {
    throw new Error("useProviderSelectionStore must be used within ProviderSelectionProvider");
  }
  return store;
}
