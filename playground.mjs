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

  [
    {
      value: "ABBA",
      valueType: "string",
    },
    {
      value: "42.3324",
      valueType: "float",
    },
    {
      value: "2022-02-02",
      valueType: "date",
    },
    {
      value: "19:03:00",
      valueType: "time",
    },
    {
      value: "2.22",
      valueType: "currency",
    },
    {
      value: "0.4223",
      valueType: "percentage",
    },
  ],

  [
    {
      value: "ABBA",
      valueType: "string",
    },
    {
      value: "42.3324",
      valueType: "float",
      cellStyle: "input"
    },
    {
      value: "2022-02-02",
      valueType: "date",
      cellStyle: "input"
    },
    {
      value: "19:03:00",
      valueType: "time",
      cellStyle: "input"
    },
    {
      value: "2.22",
      valueType: "currency",
      cellStyle: "input"
    },
    {
      value: "0.4223",
      valueType: "percentage",
      cellStyle: "input"
    },
  ],

  [
    {
      value: "ABBA",
      valueType: "string",
    },
    {
      value: "42.3324",
      valueType: "float",
      cellStyle: "calculated"
    },
    {
      value: "2022-02-02",
      valueType: "date",
      cellStyle: "calculated"
    },
    {
      value: "19:03:00",
      valueType: "time",
      cellStyle: "calculated"
    },
    {
      value: "2.22",
      valueType: "currency",
      cellStyle: "calculated"
    },
    {
      value: "0.4223",
      valueType: "percentage",
      cellStyle: "calculated"
    },
  ],
];

const mySpreadsheet = await buildSpreadsheet(spreadsheet);
await writeFile("mySpreadsheet.fods", mySpreadsheet);