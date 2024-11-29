import esbuild from "esbuild"
import process from "process"
import builtins from "builtin-modules"
import fs from "fs"

const banner = `/* Built artifact belonging to nemesarial@gmail.com */`

const prod = (process.argv[2] === "production")

const renamePlugin = (renameObj = {}) => ({
	name: 'rename-plugin',
	setup(build) {
		if (!renameObj || Object.keys(renameObj).length === 0) {
			renameObj = { './main.css': './styles.css' }
		}
		build.onEnd(async () => {
			for (const [oldPath, newPath] of Object.entries(renameObj)) {
				try {
					fs.renameSync(oldPath, newPath)
					console.log(`Renamed ${oldPath} to ${newPath}`)
				} catch (e) {
					console.error('Failed to rename file:', e)
				}
			}
		})
	},
})

const context = await esbuild.context({
	banner: {
		js: banner,
	},
	entryPoints: ["main.ts"], // Include the CSS file in the entry points
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtins],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	allowOverwrite: true,
	outdir: './',
	plugins: [
		renamePlugin({
			'./main.css': './styles.css'
		})
	],
	minify: true,
})

if (prod) {
	await context.rebuild()
	process.exit(0)
} else {
	await context.watch()
}


