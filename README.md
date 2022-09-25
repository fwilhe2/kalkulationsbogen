<p align="center">
    <img src="https://user-images.githubusercontent.com/6702424/80216211-00ef5280-863e-11ea-81de-59f3a3d4b8e4.png">
</p>
<p align="center">
    <b>Kalkulationsbogen</b> <i>Spreadsheet builder for nodejs written in TypeScript</i>
    <br>
    <br>
    <a href="https://github.com/fwilhe2/kalkulationsbogen/actions">
      <img src="https://github.com/fwilhe2/kalkulationsbogen/workflows/ci/badge.svg?branch=main">
    </a>
    <a href="https://bundlephobia.com/package/kalkulationsbogen">
      <img src="https://img.shields.io/bundlephobia/minzip/kalkulationsbogen">
    </a>
    <a href="https://www.npmjs.com/package/kalkulationsbogen">
      <img src="https://img.shields.io/npm/dw/kalkulationsbogen">
    </a>
    <a href="https://github.com/fwilhe2/kalkulationsbogen/blob/main/LICENSE">
      <img src="https://img.shields.io/npm/l/kalkulationsbogen">
    </a>
</p>
<p align="center">
  <a href="https://github.com/fwilhe2/kalkulationsbogen">Home</a>
  -
  <a href="https://github.com/fwilhe2/kalkulationsbogen">Documentation</a>
</p>

Kalkulationsbogen is a library for turing data into a spreadsheet.
It is not meant to be a general purpose tool for controlling all aspects of a spreadsheet.
The focus is on a simple and small API.

The motivation to build kalkulationsbogen was that writing out CSV files is simple but the capabilities are very limited.
For example numbers or currency values can't be nicely formatted in CSV files.

For the time being, kalkulationsbogen only supports the Open Document Spreadsheet (`ods`) format.

# Install / Import

```bash
$ npm install --save kalkulationsbogen
```

```typescript
import { buildSpreadsheet } from "kalkulationsbogen";
```

Specific imports:

```typescript
import { buildSpreadsheet } from "kalkulationsbogen/spreadsheet";
```

# Example

Example code:

```typescript
import { buildSpreadsheet } from "kalkulationsbogen";

const spreadsheet = [
  ["String", "Float", "Date", "Time", "Currency", "Percentage"],
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
];

const mySpreadsheet = await buildSpreadsheet(spreadsheet);
await writeFile("mySpreadsheet.fods", mySpreadsheet);
```
