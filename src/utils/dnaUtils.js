/**
 * DNA Utilities for Step by Step DNA Analysis
 */

/**
 * Basic AB1 Parser
 * Extracts sequence and trace data from AB1 (ABI) binary format.
 */
export function parseAB1(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));

    if (magic !== 'ABIF') {
        throw new Error('Not a valid AB1 file');
    }

    const dirOffset = view.getUint32(26);
    const numEntries = view.getUint32(18);

    if (numEntries > 2000) {
        throw new Error('Too many directory entries - file may be corrupt');
    }

    const entries = [];
    for (let i = 0; i < numEntries; i++) {
        const offset = dirOffset + (i * 28);
        if (offset + 28 > arrayBuffer.byteLength) break;

        const tagName = String.fromCharCode(
            view.getUint8(offset),
            view.getUint8(offset + 1),
            view.getUint8(offset + 2),
            view.getUint8(offset + 3)
        );
        const tagNum = view.getUint32(offset + 4);
        const type = view.getUint16(offset + 8);
        const elementSize = view.getUint16(offset + 10);
        const numElements = view.getUint32(offset + 12);
        const dataSize = view.getUint32(offset + 16);
        let dataOffset = view.getUint32(offset + 20);

        let rawData;
        if (dataSize <= 4) {
            rawData = arrayBuffer.slice(offset + 20, offset + 20 + dataSize);
        } else {
            rawData = arrayBuffer.slice(dataOffset, dataOffset + dataSize);
        }

        entries.push({ tagName, tagNum, type, numElements, rawData, dataSize });
    }

    const findTag = (name, num = 1) => entries.find(e => e.tagName === name && e.tagNum === num);

    const decodeString = (data) => new TextDecoder().decode(data);

    const pbas = findTag('PBAS', 1);
    let sequence = pbas ? decodeString(pbas.rawData).replace(/\x00/g, '').trim() : '';

    const ploc = findTag('PLOC', 1);
    let peakLocations = ploc ? new Uint16Array(ploc.rawData.slice(0, Math.floor(ploc.rawData.byteLength / 2) * 2)) : new Uint16Array(0);

    const pqual = findTag('PQUAL', 1);
    let qualities = pqual ? new Uint8Array(pqual.rawData) : new Uint8Array(0);

    // Normalize lengths
    const minLen = Math.min(sequence.length, peakLocations.length);
    sequence = sequence.slice(0, minLen);
    peakLocations = peakLocations.subarray(0, minLen);
    if (qualities.length > 0) qualities = qualities.subarray(0, minLen);

    const fwo = findTag('FWO_', 1);
    const baseOrder = fwo ? decodeString(fwo.rawData).trim() : 'GATC';

    const traces = {};
    const dataTags = [9, 10, 11, 12];
    dataTags.forEach((tagNum, idx) => {
        const tag = findTag('DATA', tagNum);
        if (tag) {
            traces[baseOrder[idx]] = new Uint16Array(tag.rawData.slice(0, Math.floor(tag.rawData.byteLength / 2) * 2));
        }
    });

    return {
        sequence,
        peakLocations,
        qualities,
        traces,
        baseOrder
    };
}

/**
 * Convert sequence to FASTA format
 */
export function toFasta(name, sequence) {
    const lines = [];
    lines.push(`>${name}`);
    for (let i = 0; i < sequence.length; i += 60) {
        lines.push(sequence.slice(i, i + 60));
    }
    return lines.join('\n');
}

/**
 * Translate DNA to Protein (3 frames)
 */
const CODON_TABLE = {
    'ATA': 'I', 'ATC': 'I', 'ATT': 'I', 'ATG': 'M',
    'ACA': 'T', 'ACC': 'T', 'ACG': 'T', 'ACT': 'T',
    'AAC': 'N', 'AAT': 'N', 'AAA': 'K', 'AAG': 'K',
    'AGC': 'S', 'AGT': 'S', 'AGA': 'R', 'AGG': 'R',
    'CTA': 'L', 'CTC': 'L', 'CTG': 'L', 'CTT': 'L',
    'CCA': 'P', 'CCC': 'P', 'CCG': 'P', 'CCT': 'P',
    'CAC': 'H', 'CAT': 'H', 'CAA': 'Q', 'CAG': 'Q',
    'CGA': 'R', 'CGC': 'R', 'CGG': 'R', 'CGT': 'R',
    'GTA': 'V', 'GTC': 'V', 'GTG': 'V', 'GTT': 'V',
    'GCA': 'A', 'GCC': 'A', 'GCG': 'A', 'GCT': 'A',
    'GAC': 'D', 'GAT': 'D', 'GAA': 'E', 'GAG': 'E',
    'GGA': 'G', 'GGC': 'G', 'GGG': 'G', 'GGT': 'G',
    'TCA': 'S', 'TCC': 'S', 'TCG': 'S', 'TCT': 'S',
    'TTC': 'F', 'TTT': 'F', 'TTA': 'L', 'TTG': 'L',
    'TAC': 'Y', 'TAT': 'Y', 'TAA': '_', 'TAG': '_',
    'TGC': 'C', 'TGT': 'C', 'TGA': '_', 'TGG': 'W',
};

export function translate(dna, frame = 0) {
    let protein = "";
    for (let i = frame; i < dna.length - 2; i += 3) {
        const codon = dna.slice(i, i + 3).toUpperCase();
        protein += CODON_TABLE[codon] || "X";
    }
    return protein;
}

/**
 * Find motifs in DNA or Protein
 */
export function findMotifs(sequence, query) {
    if (!query || query.length < 2) return [];
    const results = [];
    const regex = new RegExp(query, 'gi');
    let match;
    while ((match = regex.exec(sequence)) !== null) {
        results.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0]
        });
        // Avoid infinite loop on empty matches
        if (match.index === regex.lastIndex) regex.lastIndex++;
    }
    return results;
}
