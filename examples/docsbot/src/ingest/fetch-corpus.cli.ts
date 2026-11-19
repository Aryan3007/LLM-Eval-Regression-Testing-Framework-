import { logger } from '../lib/logger.js';
import { corpusDir, fetchCorpus, listDocFiles, SOURCE_REF } from './corpus.js';

const { downloaded } = await fetchCorpus();
const files = await listDocFiles();
logger.info(
  { source: SOURCE_REF, dir: corpusDir, files: files.length },
  downloaded ? 'Corpus downloaded' : 'Corpus already present',
);
