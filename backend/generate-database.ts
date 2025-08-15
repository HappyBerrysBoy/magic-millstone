import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import * as dotenv from "dotenv";

dotenv.config({
  path: process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : ".env",
});

// Read database init config
const args = process.argv.slice(2);
handleArgs(args);

// Function to handle arguments and log them
function handleArgs(databases: string[]) {
  if (databases.length === 0) {
    console.log("No arguments(databases) provided.");
    return;
  }

  // Create modules and providers for each database
  databases.forEach(async (database, index) => {
    console.log(`start create database ${database}`);

    const databaseDirectory = createDatabaseDirectory(database);

    createDatabaseModule(database, databaseDirectory);
    createDatabaseProvider(database, databaseDirectory);
    appModuleAdd(database);
    appServiceAdd(database);
    await createModels(database);
    createModelInterface(database, databaseDirectory);
    console.log(`end create database ${database}`);
  });
}

function createModelInterface(database: string, databaseDirectory: string) {
  let fileContent = fs.readFileSync(
    databaseDirectory + "/models/init-models.ts",
    "utf-8"
  );

  if (fileContent.indexOf("return {") < 0) {
    return;
  }

  const startIndex = fileContent.indexOf("return {") + "return {".length;
  const endIndex = startIndex + fileContent.slice(startIndex).indexOf("}");
  const extractContent = fileContent.slice(startIndex, endIndex);

  console.log(extractContent);
  // Add imports for StackstakeModule and SocialdaoModule
  fileContent =
    fileContent +
    `
export interface ${database}Models {
  ${extractContent.replace(/: /g, ": typeof _")}
}
    `;

  // console.log(fileContent);
  fs.writeFileSync(databaseDirectory + "/models/init-models.ts", fileContent);
}
function createDatabaseDirectory(database: string): string {
  if (!fs.existsSync("src/database")) {
    fs.mkdirSync("src/database");
  }

  const databaseDirectory = path.join(__dirname, "src/database", database);
  if (!fs.existsSync(databaseDirectory)) {
    fs.mkdirSync(databaseDirectory);
  }

  return databaseDirectory;
}

function createDatabaseModule(database: string, databaseDirectory: string) {
  const moduleContent = `import { Module } from '@nestjs/common';
import { ${upperFirst(
    database
  )}Providers } from '@database/${database}/${database}.providers';

@Module({
  controllers: [],
  providers: [...${upperFirst(database)}Providers],
  exports: [...${upperFirst(database)}Providers],
})
export class ${upperFirst(database)}Module {}`;
  const moduleFilePath = path.join(databaseDirectory, `${database}.module.ts`);
  fs.writeFileSync(moduleFilePath, moduleContent);
}

function createDatabaseProvider(database: string, databaseDirectory: string) {
  const providersContent = `
import { Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { initModels } from '@database/${database}/models/init-models';

export const ${upperFirst(database)}Providers = [
  {
    provide: 'DB_${database.toUpperCase()}',
    useFactory: async () => {
      const sequelize = new Sequelize({
        dialect: 'mysql',
        host: process.env.DB_${database.toUpperCase()}_HOST,
        port: parseInt(process.env.DB_${database.toUpperCase()}_PORT),
        username: process.env.DB_${database.toUpperCase()}_USERNAME,
        password: process.env.DB_${database.toUpperCase()}_PASSWORD,
        database: process.env.DB_${database.toUpperCase()}_NAME,
      });

      const models = initModels(sequelize);
      // await sequelize.sync();
      return { sequelize, models };
    },
  },
];`;
  const providersFilePath = path.join(
    databaseDirectory,
    `${database}.providers.ts`
  );
  fs.writeFileSync(providersFilePath, providersContent);
}

function appModuleAdd(database: string) {
  const appModuleFilePath = path.join(__dirname, "src/app.module.ts");
  let appModuleContent = fs.readFileSync(appModuleFilePath, "utf-8");

  if (appModuleContent.indexOf(`${upperFirst(database)}Module`) > 0) {
    return;
  }

  const importToAdd = `import { ${upperFirst(
    database
  )}Module } from '@database/${database}/${database}.module';`;

  const index = appModuleContent.indexOf("@Module");
  appModuleContent =
    appModuleContent.slice(0, index) +
    importToAdd +
    "\n" +
    appModuleContent.slice(index);

  appModuleContent = appModuleContent.replace(
    /imports: \[([\s\S]*?)\]/,
    `imports: [$1    ${upperFirst(database)}Module,\n]`
  );

  fs.writeFileSync(appModuleFilePath, appModuleContent);
}

function appServiceAdd(database: string) {
  // Append ${upperFirst(database)}Providers to DatabaseModule
  const appServiceFilePath = path.join(__dirname, "src/app.service.ts");
  let appServiceContent = fs.readFileSync(appServiceFilePath, "utf-8");

  if (appServiceContent.indexOf(`${database}Models`) > 0) {
    return;
  }
  const importToAdd = `import { ${database}Models } from '@database/${database}/models/init-models';`;

  let index = appServiceContent.indexOf("@Injectable()");
  appServiceContent =
    appServiceContent.slice(0, index) +
    importToAdd +
    "\n" +
    appServiceContent.slice(index);

  const injectToAdd = `@Inject('DB_${database.toUpperCase()}') private readonly db${upperFirst(
    database
  )}: {sequelize: Sequelize, models: ${database}Models},`;

  if (appServiceContent.indexOf(injectToAdd) > 0) {
    return;
  }

  index = appServiceContent.indexOf("constructor(") + "constructor(".length;
  // Add imports for StackstakeModule and SocialdaoModule
  appServiceContent =
    appServiceContent.slice(0, index) +
    injectToAdd +
    "\n" +
    appServiceContent.slice(index);

  appServiceContent = appServiceContent.replace(
    /imports: \[([\s\S]*?)\]/,
    `imports: [$1\n    ${upperFirst(database)}Module,]`
  );

  fs.writeFileSync(appServiceFilePath, appServiceContent);
}

// Function to capitalize the first letter of a string
function upperFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function createModels(database: string) {
  console.log("start create model");
  const modelDirectory = `./src/database/${database}/models`;
  const dtoDirectory = `./src/database/${database}/dtos`;
  const host = process.env[`DB_${database.toUpperCase()}_HOST`];
  const port = parseInt(process.env[`DB_${database.toUpperCase()}_PORT`]);
  const username = process.env[`DB_${database.toUpperCase()}_USERNAME`];
  const password = process.env[`DB_${database.toUpperCase()}_PASSWORD`];
  const databaseName = process.env[`DB_${database.toUpperCase()}_NAME`];

  const command = `sequelize-auto -o "${modelDirectory}" -d ${databaseName} -h ${host} -u ${username} -p ${port} -x ${password} -e mysql -l ts`;
  console.log(command);
  await new Promise<void>((resolve, reject) => {
    return exec(command, async (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return reject();
      }

      fs.mkdir(dtoDirectory, { recursive: true }, async (err) => {
        if (err) {
          console.error("디렉토리 생성 중 에러 발생:", err);
        }

        console.log("end create model");

        await processFilesInDirectory(modelDirectory, dtoDirectory);
      });

      return resolve();
    });
  });
}

// Function to generate DTO from file
function generateDTO(directory: string, filePath: string) {
  // Read the content of the TypeScript file
  const fileContent = fs.readFileSync(filePath, "utf-8");

  // Regular expression to match interface definition
  const interfaceRegex = /export\s+interface\s+(\w+)Attributes\s*{([^}]*)}/;
  const interfaceMatch = fileContent.match(interfaceRegex);

  // Check if interface is found
  if (interfaceMatch && interfaceMatch.length > 2) {
    // Extract interface name and content
    const interfaceName = interfaceMatch[1];
    const interfaceContent = interfaceMatch[2];

    // Extract attribute names and types from interface content
    const attributeRegex = /\s*(\w+):\s*(\w+);/g;
    let attributes: { name: string; type: string }[] = [];
    let match;
    while ((match = attributeRegex.exec(interfaceContent)) !== null) {
      attributes.push({ name: match[1], type: match[2] });
    }

    // Generate DTO class content
    let dtoContent = `import { IsString, IsOptional,IsNumber,IsDate } from 'class-validator';\n\n`;
    dtoContent += `export class ${toPascalCase(interfaceName)}Dto {\n`;

    // Iterate through attributes and generate decorators
    for (const attr of attributes) {
      let decorator = "@IsString()";

      switch (attr.type) {
        case "string":
          decorator = "@IsString()";
          break;
        case "number":
          decorator = "@IsNumber()";
          break;
        case "date":
          decorator = "@IsDate()";
          break;
      }
      //   if (attr.type === 'string') decorator += '\n  @IsOptional()';

      dtoContent += `  ${decorator}\n  ${attr.name}: ${attr.type};\n`;
    }

    dtoContent += `}\n`;

    // Create camel case file name
    // const camelCaseFileName = interfaceName.replace(/-([a-z])/g, (g) =>
    //   g[1].toUpperCase(),
    // );
    const dtoFileName = `${interfaceName.toLowerCase()}.dto.ts`;

    // Write DTO content to file
    const dtoFilePath = path.join(directory, dtoFileName);
    fs.writeFileSync(dtoFilePath, dtoContent);
  } else {
    console.error(`Interface definition not found in the file ${filePath}`);
  }
}

// Function to process all TypeScript files in a directory
function processFilesInDirectory(modelDirectory: string, dtoDirectory: string) {
  return new Promise<void>((resolve, reject) => {
    console.log("start create dtos");
    fs.readdir(modelDirectory, (err, files) => {
      if (err) {
        console.error("Error reading directory:", err);
        return reject();
      }

      // files = files.filter(
      //   (data) =>
      //     data.startsWith('node_') ||
      //     data.startsWith('airdrop_') ||
      //     data.startsWith('global_'),
      // );

      files.forEach((file) => {
        const filePath = path.join(modelDirectory, file);
        console.log(filePath);
        if (
          fs.statSync(filePath).isFile() &&
          path.extname(filePath) === ".ts"
        ) {
          generateDTO(dtoDirectory, filePath);
        }
      });

      console.log("end create dtos");
      return resolve();
    });
  });
}

function toCamelCase(str: string) {
  return str.replace(/_([a-z])/g, function (match, group) {
    return group.toUpperCase();
  });
}

function toPascalCase(str: string) {
  return str.replace(/(?:^|_)(\w)/g, function (match, group) {
    return group.toUpperCase();
  });
}
