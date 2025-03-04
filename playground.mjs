import { writeFile } from "fs/promises";
import { buildSpreadsheet, A1 } from "./dist/spreadsheet.js";

const spreadsheet = [
  [
    {
      value: "42.3324",
      valueType: "float",
      isInputCell: true,
    },
    {
      value: "42.3324",
      valueType: "float",
      isInputCell: true,
    },
    { functionName: "SUM", arguments: `[.${A1(1, 1)}:.${A1(2, 1)}]` }
  ],
];

const mySpreadsheet = await buildSpreadsheet(spreadsheet);
await writeFile("mySpreadsheet.fods", mySpreadsheet);