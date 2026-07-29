import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const workspacePath = path.resolve(
  process.cwd(),
  'pages/ProSuite/virtual-cso/VirtualCSOWorkspace.tsx',
);
const composerPath = path.resolve(
  process.cwd(),
  'components/pro-suite/virtual-cso/Composer.tsx',
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

describe('VirtualCSOWorkspace Composer routing controls', () => {
  it('exposes no Deep Mode control in either Composer branch', () => {
    const composers = composerAttributes();
    const workspaceSource = fs.readFileSync(workspacePath, 'utf8');
    const composerSource = fs.readFileSync(composerPath, 'utf8');

    expect(composers).toHaveLength(2);
    for (const attributes of composers) {
      expect(attributes).not.toContain('deepMode');
      expect(attributes).not.toContain('onDeepModeChange');
    }
    expect(workspaceSource).not.toContain('setDeepMode');
    expect(composerSource).not.toContain('Deep Mode');
    expect(composerSource).not.toContain('onDeepModeChange');
  });
});
