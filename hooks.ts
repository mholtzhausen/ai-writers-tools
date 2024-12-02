import { useContext } from "react";
import { AppContext } from "./context";
import { App } from "obsidian";
import AiWriterPlugin from "main";

export const useApp = (): App | undefined => {
	return useContext(AppContext)?.app as App;
};

export const usePlugin = (): AiWriterPlugin | undefined => {
	return useContext(AppContext)?.plugin as AiWriterPlugin;
};
