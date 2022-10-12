import { exec } from "child_process";
import { mkdir, rm, readdir } from "fs/promises";
import { promisify } from "node:util";
import path from "path";

const source = path.join('__tests__', 'output')
const target = path.join(source, 'converted')
const e = promisify(exec);

async function convertTo(format: 'xlsx' | 'ods', file: string) {
    const command = `libreoffice --headless --convert-to ${format} ${path.join(source, file)} --outdir ${target}`
    console.log('>', command)
    const p = await e(command)
    console.log(p.stdout)
    console.log(p.stderr)
}

async function convertTestFiles() {
    try {
        await rm(target, { recursive: true, force: true });
        await mkdir(target);
        const files = await readdir(source);
        for (const file of files) {
            if (file.endsWith('fods')) {
                await convertTo('xlsx', file)
                await convertTo('ods', file)
            }
        }
    } catch (err) {
        console.error(err);
    }
}

convertTestFiles()