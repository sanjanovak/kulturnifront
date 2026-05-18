import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import { NetworkData } from './sheetsService';

export interface EdgeData {
  Source: string;
  Target: string;
  Weight?: number;
}

export const calculateLouvainCommunities = (nodes: NetworkData[], edges: EdgeData[]) => {
  const graph = new Graph();

  // Add nodes
  nodes.forEach(node => {
    graph.addNode(node.Label, { ...node });
  });

  // Add edges
  edges.forEach(edge => {
    if (graph.hasNode(edge.Source) && graph.hasNode(edge.Target)) {
      graph.addEdge(edge.Source, edge.Target, {
        weight: edge.Weight || 1
      });
    }
  });

  // Run Louvain
  const communities = louvain(graph);

  // Map communities back to nodes
  return nodes.map(node => ({
    ...node,
    LouvainCommunity: `Community ${communities[node.Label]}`
  }));
};
