import { readFile, writeFile } from 'node:fs/promises';
const fixture = JSON.parse(await readFile('contracts/mobile-ui-fixture.json','utf8'));
await writeFile('mobile/test/support/ui_fixture.dart',`// Generated from contracts/mobile-ui-fixture.json; test data only.\nconst uiFixture = ${JSON.stringify(fixture,null,2).replace(/\$/g,'\\$')};\n`);
