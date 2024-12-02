// context.ts
import { createContext } from "react";
import { App } from "obsidian";
import AIWriterPlugin from "./main";

export type ContextualData = {
	app?: App;
	plugin?: AIWriterPlugin;
};

export const AppContext = createContext<ContextualData | undefined>(undefined);
