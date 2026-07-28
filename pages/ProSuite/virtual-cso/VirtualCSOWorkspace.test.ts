import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const workspacePath = path.resolve(
  process.cwd(),
  'pages/ProSuite/virtual-cso/VirtualCSOWorkspace.tsx',
);

const composerAttributes = (): string[][] => {
  const source = fs.readFileSync(workspacePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    workspacePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const results: string[][] = [];

  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
      && node.tagName.getText(sourceFile) === 'Composer'
    ) {
      results.push(
        node.attributes.properties
          .filter(ts.isJsxAttribute)
          .map((attribute) => attribute.name.getText(sourceFile)),
      );
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return results;
};

describe('VirtualCSOWorkspace Deep Mode composer wiring', () => {
  it('keeps Deep Mode controlled in both new-chat and established-thread states', () => {
    const composers = composerAttributes();

    expect(composers).toHaveLength(2);
    for (const attributes of composers) {
      expect(attributes).toContain('deepMode');
      expect(attributes).toContain('onDeepModeChange');
    }
  });
});
