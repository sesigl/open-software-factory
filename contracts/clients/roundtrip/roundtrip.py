"""Round trip for `osf-contracts roundtrip --client python`.

Arguments are Model=path pairs. Each fixture is loaded with the generated pydantic model and written back as JSON;
one line {"file": path, "json": document} per fixture.
"""
import json
import sys

import osf_contracts.models as models


def main(pairs: list[str]) -> None:
    for pair in pairs:
        model, path = pair.split("=", 1)
        with open(path, encoding="utf-8") as handle:
            value = getattr(models, model).from_json(handle.read())
        document = json.loads(value.to_json())
        print(json.dumps({"file": path, "json": document}))


if __name__ == "__main__":
    main(sys.argv[1:])
