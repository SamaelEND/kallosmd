import test from "node:test";
import assert from "node:assert/strict";
import { isExternalFileDrag, isLocalDocumentDrag, LOCAL_DOCUMENT_DRAG_TYPE } from "../src/features/workspace/dragImport.ts";

test("external file drag is recognized without treating an internal document as an import", () => {
  assert.equal(isExternalFileDrag({ types: ["Files"] } as unknown as DataTransfer), true);
  assert.equal(isExternalFileDrag({ types: ["text/plain"] } as unknown as DataTransfer), false);
  assert.equal(isExternalFileDrag(null), false);
});

test("only the app's document payload can be dropped on a workspace folder", () => {
  assert.equal(isLocalDocumentDrag({ types: [LOCAL_DOCUMENT_DRAG_TYPE] } as unknown as DataTransfer), true);
  assert.equal(isLocalDocumentDrag({ types: ["text/plain"] } as unknown as DataTransfer), false);
  assert.equal(isLocalDocumentDrag({ types: ["Files"] } as unknown as DataTransfer), false);
});
