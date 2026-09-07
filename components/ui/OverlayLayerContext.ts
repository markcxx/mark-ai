"use client";

import { createContext } from "react";

// Portaled controls inherit the layer above their containing dialog.
export const OverlayLayerContext = createContext<number | undefined>(undefined);
