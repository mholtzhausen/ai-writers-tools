// context.ts
import { createContext } from "react";
import { App } from "obsidian";

export type ContextualData = {
	app: App;
};

export const AppContext = createContext<ContextualData | undefined>(undefined);
