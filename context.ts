// context.ts
import { createContext } from "react";
import { App, Modal } from "obsidian";
import AIWriterPlugin from "./main";

export type ContextualData = {
	app?: App;
	plugin?: AIWriterPlugin;
	modal?: Modal;
};

export const AppContext = createContext<ContextualData | undefined>(undefined);
