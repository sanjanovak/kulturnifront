export interface NetworkData {
  Label: string;
  Category: string;
  Degree: number;
  WeightedDegree: number;
  Closeness: number;
  Betweenness: number;
  Eigenvector: number;
  LouvainCommunity?: string;
  [key: string]: any; // Allow flexible visual fields
}

export interface EdgeData {
  Source: string;
  Target: string;
  Weight?: number;
  Projects?: {
    [project: string]: {
      org: number;
      visit: number;
    }
  };
}

const fetchSheetValues = async (accessToken: string, spreadsheetId: string, range: string) => {
  const valuesResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!valuesResponse.ok) {
    const errorBody = await valuesResponse.text().catch(() => 'No error body');
    throw new Error(`Failed to fetch values for range ${range}: ${errorBody}`);
  }

  return await valuesResponse.json();
};

const getProjectFromHeader = (header: string): string => {
  const h = header.toLowerCase();
  if (h.includes('liburnicon')) return 'Liburnicon';
  if (h.includes('coffee house') || h.includes('debates') || h.includes('debati')) return 'Coffee House Debates';
  if (h.includes('archery') || h.includes('streličarst') || h.includes('streli')) return 'Archery Day';
  if (h.includes('kreativni nered') || h.includes('nered')) return 'Kreativni nered';
  if (h.includes('team building')) return 'Team Building';
  return 'Općenito';
};

/**
 * Extracts co-occurrence pairs and calculates centralities directly from raw questionnaire rows.
 */
export const parseRawSurveyData = (rows: any[][], headers: string[]): { nodes: NetworkData[], edges: EdgeData[] } => {
  const columnsWithNamesIndices: { index: number; project: string; type: 'org' | 'visit' }[] = [];
  
  headers.forEach((h, idx) => {
    const hl = h.toLowerCase();
    if (
      hl.includes('najviše surađujete') || 
      hl.includes('najviše socijalizirate') || 
      hl.includes('socijalizirate') ||
      hl.includes('provodite najviše vremena') ||
      hl.includes('surad') ||
      hl.includes('socijal')
    ) {
      const isOrg = hl.includes('organizacij') || hl.includes('surad') || hl.includes('organizacija');
      columnsWithNamesIndices.push({
        index: idx,
        project: getProjectFromHeader(h),
        type: isOrg ? 'org' : 'visit'
      });
    }
  });

  const memberSet = new Set<string>();
  const edgeWeightMap = new Map<string, number>();
  const edgeProjectsMap = new Map<string, { [project: string]: { org: number; visit: number } }>();
  const personProjectMentions: { [name: string]: { [project: string]: number } } = {};

  // Parse each row
  rows.forEach(row => {
    columnsWithNamesIndices.forEach(({ index, project, type }) => {
      const cellValue = row[index];
      if (cellValue && typeof cellValue === 'string' && cellValue.trim() !== "") {
        // Split names by comma, semicolon or similar delimiters
        const members = cellValue
          .split(/[,;]/)
          .map(m => m.trim())
          .filter(m => m.length > 0 && m.toLowerCase() !== 'da' && m.toLowerCase() !== 'ne');

        // Increment mentions for Category designation
        members.forEach(member => {
          memberSet.add(member);
          if (!personProjectMentions[member]) {
            personProjectMentions[member] = {};
          }
          personProjectMentions[member][project] = (personProjectMentions[member][project] || 0) + 1;
        });

        // Generate pairs for connections co-occurrence
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const p1 = members[i];
            const p2 = members[j];
            if (p1 === p2) continue; // Skip self loans
            
            const [source, target] = p1 < p2 ? [p1, p2] : [p2, p1];
            const edgeKey = `${source}///${target}`;
            edgeWeightMap.set(edgeKey, (edgeWeightMap.get(edgeKey) || 0) + 1);

            // Record breakdown by project and type
            if (!edgeProjectsMap.has(edgeKey)) {
              edgeProjectsMap.set(edgeKey, {});
            }
            const projMap = edgeProjectsMap.get(edgeKey)!;
            if (!projMap[project]) {
              projMap[project] = { org: 0, visit: 0 };
            }
            if (type === 'org') {
              projMap[project].org += 1;
            } else {
              projMap[project].visit += 1;
            }
          }
        }
      }
    });
  });

  const nodesList = Array.from(memberSet).sort();
  const edgesList: EdgeData[] = Array.from(edgeWeightMap.entries()).map(([key, weight]) => {
    const [source, target] = key.split('///');
    const projects = edgeProjectsMap.get(key) || {};
    return { Source: source, Target: target, Weight: weight, Projects: projects };
  });

  // Calculate network metrics dynamically in TypeScript
  const N = nodesList.length;
  const adjacency: { [node: string]: { node: string; weight: number }[] } = {};
  const neighborsMap: { [node: string]: Set<string> } = {};

  nodesList.forEach(node => {
    adjacency[node] = [];
    neighborsMap[node] = new Set<string>();
  });

  edgesList.forEach(edge => {
    const s = edge.Source;
    const t = edge.Target;
    const w = edge.Weight || 1;
    if (adjacency[s] && adjacency[t]) {
      adjacency[s].push({ node: t, weight: w });
      adjacency[t].push({ node: s, weight: w });
      neighborsMap[s].add(t);
      neighborsMap[t].add(s);
    }
  });

  // 1. Degree & Weighted Degree
  const degreeMap: { [node: string]: number } = {};
  const weightedDegreeMap: { [node: string]: number } = {};
  nodesList.forEach(node => {
    degreeMap[node] = neighborsMap[node].size;
    weightedDegreeMap[node] = adjacency[node].reduce((sum, adj) => sum + adj.weight, 0);
  });

  // 2. Closeness Centrality
  const closenessMap: { [node: string]: number } = {};
  nodesList.forEach(startNode => {
    // Breadth-First Search to find all shortest path lengths
    const distances: { [node: string]: number } = {};
    nodesList.forEach(n => distances[n] = Infinity);
    distances[startNode] = 0;

    const queue: string[] = [startNode];
    let head = 0;

    while (head < queue.length) {
      const curr = queue[head++];
      const currDist = distances[curr];
      const neighbors = neighborsMap[curr] || [];
      
      neighbors.forEach(neighbor => {
        if (distances[neighbor] === Infinity) {
          distances[neighbor] = currDist + 1;
          queue.push(neighbor);
        }
      });
    }

    let reachableCount = 0;
    let sumDistances = 0;

    nodesList.forEach(n => {
      if (n !== startNode && distances[n] !== Infinity) {
        reachableCount++;
        sumDistances += distances[n];
      }
    });

    if (sumDistances > 0 && N > 1) {
      // Wasserman-Weyman formula for disconnected graphs (standard NetworkX formulation)
      closenessMap[startNode] = (reachableCount / (N - 1)) * (reachableCount / sumDistances);
    } else {
      closenessMap[startNode] = 0;
    }
  });

  // 3. Betweenness Centrality (Brandes' Algorithm)
  const betweennessMap: { [node: string]: number } = {};
  nodesList.forEach(n => betweennessMap[n] = 0);

  for (const s of nodesList) {
    const Stack: string[] = [];
    const Predecessors: { [node: string]: string[] } = {};
    const sigma: { [node: string]: number } = {};
    const d: { [node: string]: number } = {};

    nodesList.forEach(n => {
      Predecessors[n] = [];
      sigma[n] = 0;
      d[n] = -1;
    });

    sigma[s] = 1;
    d[s] = 0;

    const Q: string[] = [s];
    let qHead = 0;

    while (qHead < Q.length) {
      const v = Q[qHead++];
      Stack.push(v);

      const neighbors = neighborsMap[v] || [];
      for (const w of neighbors) {
        if (d[w] < 0) {
          Q.push(w);
          d[w] = d[v] + 1;
        }
        if (d[w] === d[v] + 1) {
          sigma[w] += sigma[v];
          Predecessors[w].push(v);
        }
      }
    }

    const delta: { [node: string]: number } = {};
    nodesList.forEach(n => delta[n] = 0);

    while (Stack.length > 0) {
      const w = Stack.pop()!;
      for (const v of Predecessors[w]) {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      }
      if (w !== s) {
        betweennessMap[w] += delta[w];
      }
    }
  }

  // Normalization factor for undirected graph betweenness
  // NetworkX: score = score * 0.5 (for undirected traversal counting twice) * 2 / ((N-1)*(N-2)) = score / ((N-1)*(N-2))
  const betweennessScale = N > 2 ? 1 / ((N - 1) * (N - 2)) : 1.0;
  nodesList.forEach(node => {
    betweennessMap[node] = betweennessMap[node] * betweennessScale;
  });

  // 4. Eigenvector Centrality (Power Iteration, 50 cycles)
  const eigenvectorMap: { [node: string]: number } = {};
  nodesList.forEach(node => eigenvectorMap[node] = 1.0 / Math.sqrt(N));

  for (let iter = 0; iter < 50; iter++) {
    const nextEigen: { [node: string]: number } = {};
    let sumSquares = 0;

    for (const u of nodesList) {
      let sum = 0;
      const incident = adjacency[u] || [];
      for (const adj of incident) {
        sum += eigenvectorMap[adj.node] * adj.weight;
      }
      nextEigen[u] = sum;
      sumSquares += sum * sum;
    }

    const norm = Math.sqrt(sumSquares);
    if (norm === 0) break;

    let difference = 0;
    for (const u of nodesList) {
      const newValue = nextEigen[u] / norm;
      difference += Math.abs(newValue - eigenvectorMap[u]);
      eigenvectorMap[u] = newValue;
    }

    if (difference < 1e-6) break;
  }

  // Build final node list
  const nodes: NetworkData[] = nodesList.map(name => {
    // Find dominant project Category
    const mentions = personProjectMentions[name] || {};
    let dominantProject = 'Općenito';
    let maxCount = -1;
    for (const [p, count] of Object.entries(mentions)) {
      if (count > maxCount) {
        maxCount = count;
        dominantProject = p;
      }
    }

    return {
      Label: name,
      Category: dominantProject,
      Degree: degreeMap[name],
      WeightedDegree: weightedDegreeMap[name],
      Closeness: closenessMap[name],
      Betweenness: betweennessMap[name],
      Eigenvector: eigenvectorMap[name]
    };
  });

  return { nodes, edges: edgesList };
};

export const fetchSpreadsheetData = async (accessToken: string, spreadsheetId: string): Promise<{ nodes: NetworkData[], edges: EdgeData[] }> => {
  const spreadsheetResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!spreadsheetResponse.ok) {
    const errorBody = await spreadsheetResponse.text().catch(() => 'No error body');
    throw new Error(`Failed to fetch spreadsheet metadata: ${errorBody}`);
  }

  const spreadsheet = await spreadsheetResponse.json();
  
  // Find "Nodes" sheet, or default to the primary sheet (gid 875430312 / first sheet)
  const nodeGid = '875430312';
  const nodeSheet = spreadsheet.sheets.find((s: any) => s.properties.sheetId.toString() === nodeGid) || spreadsheet.sheets[0];
  const edgeSheet = spreadsheet.sheets.find((s: any) => 
    s.properties.title.toLowerCase().includes('edge') || 
    s.properties.title.toLowerCase().includes('veze') ||
    s.properties.title.toLowerCase().includes('rubovi')
  );

  // Fetch from the node/raw sheet
  const nodeData = await fetchSheetValues(accessToken, spreadsheetId, `${nodeSheet.properties.title}!A1:Z5000`);
  const nodeRows = nodeData.values || [];
  
  if (nodeRows.length === 0) return { nodes: [], edges: [] };

  const nodeHeaders = nodeRows[0].map((h: string) => h.trim());

  // Detect if this sheet contains raw survey questionnaire rows instead of computed nodes
  const isRawSurvey = nodeHeaders.some((h: string) => 
    h.toLowerCase().includes('vremenska oznaka') || 
    h.toLowerCase().includes('timestamp') || 
    h.toLowerCase().includes('najviše surađujete') || 
    h.toLowerCase().includes('socijalizirate')
  );

  if (isRawSurvey) {
    // Execute on-the-fly co-occurrence parsing & centrality mapping
    return parseRawSurveyData(nodeRows.slice(1), nodeHeaders);
  }

  // Pre-calculated tables logic (scenario 1)
  const findNodeIdx = (terms: string[]) => nodeHeaders.findIndex((h: string) => terms.some(t => h.toLowerCase().includes(t.toLowerCase())));

  const labelIdx = findNodeIdx(['Label', 'Name', 'Čvor', 'Id']);
  const categoryIdx = findNodeIdx(['Category', 'Kategorija', 'Kluster']);
  const degreeIdx = findNodeIdx(['Degree', 'Stupanj']);
  const wDegreeIdx = findNodeIdx(['Weighted Degree', 'Težinski stupanj']);
  const closenessIdx = findNodeIdx(['Closeness', 'Bliskost']);
  const betweennessIdx = findNodeIdx(['Betweenness', 'Između']);
  const eigenvectorIdx = findNodeIdx(['Eigenvector', 'Svojstvena']);

  const nodes: NetworkData[] = nodeRows.slice(1).map((row: any[]) => ({
    Label: row[labelIdx] || 'Unknown',
    Category: row[categoryIdx] || 'Uncategorized',
    Degree: parseFloat(row[degreeIdx]) || 0,
    WeightedDegree: parseFloat(row[wDegreeIdx]) || 0,
    Closeness: parseFloat(row[closenessIdx]) || 0,
    Betweenness: parseFloat(row[betweennessIdx]) || 0,
    Eigenvector: parseFloat(row[eigenvectorIdx]) || 0,
  }));

  // Fetch Edges if found
  let edges: EdgeData[] = [];
  if (edgeSheet) {
    try {
      const edgeDataJson = await fetchSheetValues(accessToken, spreadsheetId, `${edgeSheet.properties.title}!A1:Z10000`);
      const edgeRows = edgeDataJson.values || [];
      if (edgeRows.length > 1) {
        const edgeHeaders = edgeRows[0].map((h: string) => h.trim());
        const findEdgeIdx = (terms: string[]) => edgeHeaders.findIndex((h: string) => terms.some(t => h.toLowerCase().includes(t.toLowerCase())));
        
        const sourceIdx = findEdgeIdx(['Source', 'Izvor', 'Od']);
        const targetIdx = findEdgeIdx(['Target', 'Cilj', 'Do']);
        const weightIdx = findEdgeIdx(['Weight', 'Težina']);

        edges = edgeRows.slice(1).map((row: any[]) => ({
          Source: row[sourceIdx],
          Target: row[targetIdx],
          Weight: parseFloat(row[weightIdx]) || 1,
        })).filter(e => e.Source && e.Target);
      }
    } catch (e) {
      console.warn('Failed to fetch edges:', e);
    }
  }

  return { nodes, edges };
};
