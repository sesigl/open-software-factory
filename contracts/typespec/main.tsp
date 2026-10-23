// The single source of the shared formats (ADR 0006). `pnpm build` emits one JSON Schema per format into
// contracts/<format>/<format>.schema.json and an OpenAPI 3.1 document for the generated clients.
import "@typespec/json-schema";
import "./common.tsp";
import "./factory-definition.tsp";
import "./work-item.tsp";
import "./run-record.tsp";
import "./evidence-bundle.tsp";
import "./score.tsp";
import "./events.tsp";
import "./gatekeeper.tsp";
import "./gatekeeper-api.tsp";
import "./sandbox.tsp";
