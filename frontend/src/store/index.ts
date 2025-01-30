import { configureStore } from "@reduxjs/toolkit";
import { createLogger } from "redux-logger";

import masterDataReducer from "./slices/masterDataSlice";
import searchReducer from "./slices/searchSlice";

const logger = createLogger({
  collapsed: true, // Collapse logs by default
  duration: true, // Print the duration of each action
  timestamp: true,
  predicate: (getState, action) => process.env.NODE_ENV === "development"
});

export const store = configureStore({
  reducer: {
    search: searchReducer,
    masterData: masterDataReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ["your-non-serializable-action-type"]
      }
    }).concat(logger),
  devTools: process.env.NODE_ENV !== "production"
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;