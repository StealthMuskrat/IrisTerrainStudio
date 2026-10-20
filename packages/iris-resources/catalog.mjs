const labels = { dimensions: 'Dimensions', regions: 'Regions', biomes: 'Biomes', generators: 'Noise & Generators', caves: 'Caves & Carving', deposits: 'Deposits & Ores', trees: 'Procedural Trees', objects: 'Objects', snippet: 'Reusable Snippets', snippets: 'Reusable Snippets', images: 'Image Maps' };
const excluded = new Set(['entities','spawners','loot','loot-tables','items','jigsaw','structures','schematics','mods','scripts']);
export function category(path) { const folder = path.split('/')[0]; return { id: folder, label: labels[folder] || folder.replaceAll('-', ' ').replace(/^./, c => c.toUpperCase()), excluded: excluded.has(folder) }; }
export function resourceId(path) { return path.replace(/^[^/]+\//, '').replace(/\.json$/i, ''); }
export class ResourceCatalog {
  constructor(resources = []) {
    this.resources = resources; this.byPath = new Map(resources.map(row => [row.path, row])); this.byId = new Map();
    for (const row of resources) for (const id of new Set([resourceId(row.path),row.path,row.path.replace(/\.json$/i,'')])) { const entries=this.byId.get(id)||[];entries.push(row);this.byId.set(id,entries); }
  }
  groups(query = '') { const result = new Map(); for (const row of this.resources) { if (query && !row.path.toLowerCase().includes(query.toLowerCase())) continue; const group = category(row.path); if (!result.has(group.id)) result.set(group.id, { ...group, resources: [] }); result.get(group.id).resources.push(row); } return [...result.values()].sort((a, b) => a.label.localeCompare(b.label)); }
  candidates(value, folder) { return (this.byId.get(value) || []).filter(row => !folder || row.path.startsWith(folder + '/')); }
  possibleReferences(document, ownPath) {
    const references = [];
    for (const node of document.nodes.values()) if (node.type === 'string') {
      const matches = [...(this.byId.get(node.value) || []), ...(this.byPath.has(node.value) ? [this.byPath.get(node.value)] : [])].filter(row => row.path !== ownPath);
      if (matches.length) references.push({ pointer: node.pointer, value: node.value, targets: [...new Set(matches.map(row => row.path))] });
    }
    return references;
  }
}
