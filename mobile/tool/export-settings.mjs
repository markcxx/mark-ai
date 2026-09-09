import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
const result = await build({stdin:{contents:`export { DEFAULT_SETTINGS } from './lib/settings'; export { SPEECH_VOICES } from './lib/chat/speech-voices'; export { MODEL_METADATA } from './lib/model-metadata'; export { IMAGE_GENERATION_MODEL_IDS } from './lib/chat/image-models'; export { BUILTIN_TOOLS } from './lib/tools/registry';`, resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const values = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
await writeFile('mobile/lib/features/settings/default_settings.dart',`// Generated from lib/settings.ts and lib/chat/speech-voices.ts.\nconst defaultSettings = ${JSON.stringify(values.DEFAULT_SETTINGS,null,2)};\nconst speechVoices = ${JSON.stringify(values.SPEECH_VOICES,null,2)};\n`);

await writeFile('mobile/lib/shared/models/model_metadata_data.dart', `// Generated from lib/model-metadata.ts and lib/chat/image-models.ts.\nconst modelMetadata = ${JSON.stringify(values.MODEL_METADATA,null,2).replace(/\$/g,'\\$')};\nconst imageGenerationModelIds = ${JSON.stringify(values.IMAGE_GENERATION_MODEL_IDS)};\n`);

await writeFile('mobile/lib/shared/models/tool_context_data.dart', `// Generated from lib/tools/registry.ts; public tool definitions.\nconst toolContextData = ${JSON.stringify(values.BUILTIN_TOOLS.filter(t=>t.status === 'available').map(t=>({id:t.id,prompt:t.systemPrompt,functions:t.functions})),null,2).replace(/\$/g,'\\$')};\n`);
