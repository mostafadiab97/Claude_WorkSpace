// PUBLIC ENTRY of the sample-data module. Other code may import only from this file.
// Responsibility: realistic, reproducible fictional requirement sets (a smart-thermostat product) for
// performance tests, the in-app data self-test and demos. Not used for real data.
export { generateItems, type SampleOptions } from './generate'
export { runDataBenchmark, type BenchmarkResult } from './benchmark'
