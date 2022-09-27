import { expect, test } from "@jest/globals";
import { exec } from "child_process";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { promisify } from "util";
import { buildSpreadsheet, spreadsheetInput } from "../src";

describe("Unit tests", () => {
  test("buildSpreadsheet creates expected cells", async () => {
    const input: spreadsheetInput = [
      ["a", "b", "c"],
      [
        { value: "1", valueType: "float" },
        { value: "2", valueType: "float" },
        { value: "3", valueType: "float" },
      ],
    ];
    const actual = await buildSpreadsheet(input);
    expect(actual).toMatch('<table:table-cell office:value-type="string" calcext:value-type="string"> <text:p><![CDATA[a]]></text:p> </table:table-cell>');
    expect(actual).toMatch('<table:table-cell office:value-type="string" calcext:value-type="string"> <text:p><![CDATA[b]]></text:p> </table:table-cell>');
    expect(actual).toMatch('<table:table-cell office:value-type="string" calcext:value-type="string"> <text:p><![CDATA[c]]></text:p> </table:table-cell>');
    expect(actual).toMatch('<table:table-cell office:value="1" table:style-name="FLOAT_STYLE" office:value-type="float" calcext:value-type="float" />');
    expect(actual).toMatch('<table:table-cell office:value="2" table:style-name="FLOAT_STYLE" office:value-type="float" calcext:value-type="float" />');
    expect(actual).toMatch('<table:table-cell office:value="3" table:style-name="FLOAT_STYLE" office:value-type="float" calcext:value-type="float" />');
  });
});

describe("Spreadsheet builder", () => {
  beforeAll(async () => {
    await rm("__tests__/output", { recursive: true, force: true });
    await mkdir("__tests__/output");
  });

  async function integrationTest(name: string, actualSpreadsheet: spreadsheetInput, expectedCsv: string) {
    const actualFods = await buildSpreadsheet(actualSpreadsheet);
    await writeFile(`__tests__/output/${name}.fods`, actualFods);

    // todo: see why this did not work using execa

    const e = promisify(exec);
    const p = await e(`libreoffice --headless --convert-to csv:"Text - txt - csv (StarCalc)":"44,34,76,1,,1031,true,true" __tests__/output/${name}.fods --outdir __tests__/output`);

    expect(p.stderr).toEqual("");

    const actualCsv = (await readFile(`__tests__/output/${name}.csv`)).toString();
    expect(actualCsv).toEqual(expectedCsv);
  }

  test("Creating a spreadsheet which can be opened using libreoffice - check the csv output is identical", async () => {
    const expectedCsv = `"String","Float","Date","Time","Currency","Currency with Cents","Percentage"\n"ABBA",42.33,2022-02-02,19:03:00,3.00€,2.22€,42.23%\n`;

    const spreadsheet = JSON.parse((await readFile("__tests__/data-formats.json")).toString());
    await integrationTest("common-data-formats", spreadsheet, expectedCsv);
  });

  test("Performance Model Spreadsheet", async () => {
    const expectedCsv = `"Number of CPUs","Parallel Computing Time","Sequential Computing Time","Speedup","Efficiency"\n4.00,"25,800.00","100,000.00",3.88,0.97\n5.00,"21,000.00","100,000.00",4.76,0.95\n6.00,"17,866.67","100,000.00",5.60,0.93\n`;
    const problemSizeX = 100;
    const problemSizeY = 100;
    const calculationTimePerCell = 10;
    const numberOfOperations = 1;
    const communicationTimePerCell = 200;
    const mySpreadsheet: spreadsheetInput = [["Number of CPUs", "Parallel Computing Time", "Sequential Computing Time", "Speedup", "Efficiency"]];
    for (let numberOfCpus = 4; numberOfCpus < 7; numberOfCpus++) {
      const timeParallel = (problemSizeX / numberOfCpus) * problemSizeY * calculationTimePerCell * numberOfOperations + communicationTimePerCell * numberOfCpus;
      const timeSequential = problemSizeX * problemSizeY * calculationTimePerCell * numberOfOperations;
      const speedup = timeSequential / timeParallel;
      mySpreadsheet.push([
        {
          value: numberOfCpus.toString(),
          valueType: "float",
        },
        {
          value: `${timeParallel}`,
          valueType: "float",
        },
        {
          value: `${timeSequential}`,
          valueType: "float",
        },
        {
          value: `${speedup}`,
          valueType: "float",
        },
        {
          value: `${speedup / numberOfCpus}`,
          valueType: "float",
        },
      ]);
    }
    await integrationTest("performance-model", mySpreadsheet, expectedCsv);
  });

  test("CDATA needs to be escaped", async () => {
    const expectedCsv = `"<xml is=""a thing"">","foo & bar"\n`;

    const spreadsheet = [['<xml is="a thing">', "foo & bar"]];
    await integrationTest("cdata", spreadsheet, expectedCsv);
  });
});
