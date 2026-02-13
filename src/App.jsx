import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload,
    FileCode,
    Activity,
    Dna,
    Edit3,
    Search,
    Tag,
    ZoomIn,
    ZoomOut,
    CheckCircle2,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Save
} from 'lucide-react';
import { parseAB1, toFasta, translate, findMotifs } from './utils/dnaUtils';
import Chromatogram from './Chromatogram';
import { toJpeg } from 'html-to-image';

const AnnotationHighlight = ({ sequence, annotations }) => {
    if (!annotations.length) return <span className="break-all">{sequence}</span>;

    // Find all matches for all annotations
    let segments = [{ text: sequence, isMatch: false, label: null }];

    annotations.forEach(ann => {
        let nextSegments = [];
        segments.forEach(seg => {
            if (seg.isMatch) {
                nextSegments.push(seg);
                return;
            }

            const regex = new RegExp(ann.query, 'gi');
            let lastIdx = 0;
            let match;
            while ((match = regex.exec(seg.text)) !== null) {
                if (match.index > lastIdx) {
                    nextSegments.push({ text: seg.text.slice(lastIdx, match.index), isMatch: false, label: null });
                }
                nextSegments.push({ text: match[0], isMatch: true, label: ann.name });
                lastIdx = regex.lastIndex;
            }
            if (lastIdx < seg.text.length) {
                nextSegments.push({ text: seg.text.slice(lastIdx), isMatch: false, label: null });
            }
        });
        segments = nextSegments;
    });

    return (
        <div className="flex flex-wrap gap-y-3 leading-relaxed break-all py-2">
            {segments.map((seg, i) => (
                <span
                    key={i}
                    className={seg.isMatch ? "text-red-600 font-extrabold px-1 bg-red-50 rounded-md relative flex flex-col items-center group mb-2 border border-red-100" : "text-gray-700"}
                >
                    {seg.isMatch && (
                        <span className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded-t-sm shadow-sm absolute -top-[1.1rem] left-0 right-0 text-center truncate pointer-events-none">
                            {seg.label}
                        </span>
                    )}
                    {seg.text}
                </span>
            ))}
        </div>
    );
};

const Card = ({ title, icon: Icon, children, status = 'pending', id }) => (
    <motion.div
        id={id}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className={`mb-8 p-6 bg-white rounded-2xl shadow-xl border-2 transition-all duration-300 ${status === 'active' ? 'border-blue-500 ring-4 ring-blue-50 shadow-2xl' :
            status === 'completed' ? 'border-green-500 shadow-lg' : 'border-transparent opacity-60'
            }`}
    >
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                    <Icon className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">{title}</h2>
            </div>
            {status === 'completed' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
        </div>
        <div className="text-gray-600">
            {children}
        </div>
    </motion.div>
);

export default function App() {
    const [fileData, setFileData] = useState(null);
    const [error, setError] = useState(null);
    const [fasta, setFasta] = useState('');
    const [editedSequence, setEditedSequence] = useState('');
    const [viewWindow, setViewWindow] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [selectedFrame, setSelectedFrame] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [findQuery, setFindQuery] = useState('');
    const [replaceQuery, setReplaceQuery] = useState('');
    const [annotations, setAnnotations] = useState([]);

    const handleFileUpload = useCallback(async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            setError(null);
            const arrayBuffer = await file.arrayBuffer();
            const result = parseAB1(arrayBuffer);
            setFileData({ ...result, fileName: file.name });
            setEditedSequence(result.sequence);
            setFasta(toFasta(file.name, result.sequence));
        } catch (err) {
            console.error(err);
            setError('Failed to parse AB1 file. Please ensure it is a valid .ab1 format.');
        }
    }, []);

    const handleSequenceChange = (e) => {
        const newSeq = e.target.value.toUpperCase().replace(/[^GATC]/g, '');
        setEditedSequence(newSeq);
    };

    const handleDownloadFasta = () => {
        if (!fasta) return;
        const blob = new Blob([fasta], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileData?.fileName || 'sequence'}.fasta`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const protein = useMemo(() => {
        if (!editedSequence) return '';
        return translate(editedSequence, selectedFrame);
    }, [editedSequence, selectedFrame]);

    const searchResults = useMemo(() => {
        return findMotifs(editedSequence, searchQuery);
    }, [editedSequence, searchQuery]);

    const handleExportJpg = async () => {
        const node = document.getElementById('annotation-step-card');
        if (!node) return;
        try {
            const dataUrl = await toJpeg(node, { quality: 0.95, backgroundColor: '#f8fafc' });
            const link = document.createElement('a');
            link.download = `dna-analysis-annotation-${Date.now()}.jpg`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Failed to export JPG:', err);
        }
    };

    const handleExportComparisonJpg = async () => {
        const node = document.getElementById('comparison-box');
        if (!node) return;
        try {
            const dataUrl = await toJpeg(node, { quality: 1, backgroundColor: '#f3f4f6' });
            const link = document.createElement('a');
            link.download = `dna-translation-comparison-${Date.now()}.jpg`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Failed to export comparison JPG:', err);
        }
    };

    const handleSearchReplace = () => {
        if (!findQuery) return;
        const newSeq = editedSequence.split(findQuery.toUpperCase()).join(replaceQuery.toUpperCase());
        setEditedSequence(newSeq);
        setFindQuery('');
        setReplaceQuery('');
    };

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <header className="mb-12 text-center text-blue-900">
                    <motion.h1
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-4xl font-extrabold sm:text-5xl"
                    >
                        Step by Step <span className="text-blue-600">DNA Analysis</span>
                    </motion.h1>
                    <p className="mt-4 text-xl text-gray-500 font-medium">
                        A seamless professional workflow for genomic processing
                    </p>
                </header>

                <div className="space-y-4">
                    {/* STEP 1: UPLOAD */}
                    <Card
                        title="1. Upload Original File"
                        icon={Upload}
                        status={fileData ? 'completed' : 'active'}
                    >
                        <p className="mb-4">Upload your .AB1 sequence file to begin the analysis.</p>
                        <div className="relative group">
                            <input
                                type="file"
                                accept=".ab1"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className={`p-8 border-2 border-dashed rounded-xl text-center transition-colors ${fileData ? 'border-green-200 bg-green-50' : 'border-gray-200 group-hover:border-blue-400'
                                }`}>
                                {fileData ? (
                                    <p className="text-green-700 font-medium flex items-center justify-center gap-2">
                                        <CheckCircle2 className="w-5 h-5" /> Loaded: {fileData.fileName}
                                    </p>
                                ) : (
                                    <p className="text-gray-500">Click or drag .ab1 file here</p>
                                )}
                            </div>
                        </div>
                        {error && (
                            <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                                <AlertCircle className="w-5 h-5" />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}
                    </Card>

                    {/* STEP 2: CONVERSION */}
                    <Card
                        title="2. Convert to FASTA"
                        icon={FileCode}
                        status={fasta ? 'completed' : fileData ? 'active' : 'pending'}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-sm">Raw sequence data extracted and formatted into standard FASTA record.</p>
                            {fasta && (
                                <button
                                    onClick={handleDownloadFasta}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    <Save className="w-4 h-4" /> Download .FASTA
                                </button>
                            )}
                        </div>
                        {fasta && (
                            <pre className="p-4 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto font-mono max-h-40 shadow-inner">
                                {fasta}
                            </pre>
                        )}
                    </Card>

                    {/* STEP 3: VISUALIZATION */}
                    <Card
                        title="3. DNA Sequence & Chromatograph"
                        icon={Activity}
                        status={fileData ? 'completed' : 'pending'}
                    >
                        <p className="mb-4">Interactive visualization of base peaks and electronic sequence data.</p>
                        {fileData && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg mb-2">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setViewWindow(Math.max(0, viewWindow - 50))}
                                            className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30"
                                            disabled={viewWindow === 0}
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setViewWindow(viewWindow + 50)}
                                            className="p-1 hover:bg-white rounded shadow-sm"
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                        Position: {viewWindow} bp
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setZoomLevel(Math.min(5, zoomLevel + 0.5))}
                                            className="p-1 hover:bg-white rounded shadow-sm text-blue-600"
                                            title="Zoom In"
                                        >
                                            <ZoomIn className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))}
                                            className="p-1 hover:bg-white rounded shadow-sm text-blue-600"
                                            title="Zoom Out"
                                        >
                                            <ZoomOut className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <Chromatogram data={fileData} start={viewWindow * 10} length={1000} zoom={zoomLevel} />
                                <div className="flex flex-wrap gap-1 mt-2 font-mono text-sm justify-center">
                                    {editedSequence.slice(viewWindow, viewWindow + Math.floor(40 / zoomLevel)).split('').map((base, i) => (
                                        <span key={i} className={`w-5 h-7 flex items-center justify-center rounded text-xs transition-colors ${base === 'A' ? 'bg-green-100 text-green-800' :
                                            base === 'T' ? 'bg-red-100 text-red-800' :
                                                base === 'C' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                            }`}>
                                            {base}
                                        </span>
                                    ))}
                                    <span className="flex items-center text-gray-400 px-2 italic">...</span>
                                </div>

                                {/* PERSISTENT HIGHLIGHTS PREVIEW */}
                                {annotations.length > 0 && (
                                    <div className="p-3 bg-white border border-dashed border-red-200 rounded-lg mt-4 shadow-sm">
                                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Annotated Domains</p>
                                        <div className="max-h-24 overflow-y-auto text-xs font-mono leading-relaxed">
                                            <AnnotationHighlight sequence={editedSequence} annotations={annotations} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* STEP 4: TRANSLATION */}
                    <Card
                        title="4. Amino Acid Translation"
                        icon={Dna}
                        status={protein ? 'completed' : 'pending'}
                    >
                        <p className="mb-4">Generate protein sequences from 3 reading frames. Choose the correct frame below.</p>
                        {protein && (
                            <div className="space-y-4">
                                <div className="flex gap-2 mb-4">
                                    {[0, 1, 2].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setSelectedFrame(f)}
                                            className={`px-4 py-3 rounded-xl font-bold text-sm transition-all ${selectedFrame === f
                                                ? 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-100'
                                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                                                }`}
                                        >
                                            Frame +{f + 1}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative group">
                                    <pre className="p-4 bg-blue-900 text-blue-100 rounded-lg text-sm overflow-x-auto font-mono max-h-40 shadow-inner break-all whitespace-pre-wrap leading-relaxed">
                                        {protein}
                                    </pre>
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="px-2 py-1 bg-blue-800 text-[10px] text-blue-200 rounded uppercase font-bold tracking-tighter">
                                            Protein View
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* STEP 5: MANUAL CORRECTION */}
                    <Card
                        title="5. Manual Correction"
                        icon={Edit3}
                        status={editedSequence && editedSequence !== (fileData?.sequence || '') ? 'completed' : editedSequence ? 'active' : 'pending'}
                    >
                        <p className="mb-4">Refine your sequence with direct base-level editing tools. Only G, A, T, C characters are allowed.</p>
                        {editedSequence && (
                            <div className="space-y-6">
                                {/* SEARCH & REPLACE TOOL */}
                                <div className="p-4 bg-gray-50 border-2 border-gray-100 rounded-xl shadow-sm space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Search & Replace Tool</span>
                                        {findQuery && (
                                            <span className="text-[9px] font-bold text-blue-500 animate-pulse bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                                Live Highlighting Active
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        {/* ... (rest of the inputs) */}
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={findQuery}
                                                onChange={(e) => setFindQuery(e.target.value)}
                                                placeholder="Find motif..."
                                                className="w-full pl-3 pr-3 py-2 bg-white border-2 border-transparent focus:border-blue-400 transition-all outline-none uppercase font-mono rounded-lg text-sm"
                                            />
                                        </div>
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={replaceQuery}
                                                onChange={(e) => setReplaceQuery(e.target.value)}
                                                placeholder="Replace with..."
                                                className="w-full pl-3 pr-3 py-2 bg-white border-2 border-transparent focus:border-blue-400 transition-all outline-none uppercase font-mono rounded-lg text-sm"
                                            />
                                        </div>
                                        <button
                                            onClick={handleSearchReplace}
                                            className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg text-sm hover:bg-blue-700 transition-colors shadow-sm"
                                        >
                                            Replace All
                                        </button>
                                    </div>
                                </div>

                                {/* LIVE PREVIEW WITH HIGHLIGHTING */}
                                {findQuery && (
                                    <div className="p-4 bg-white border border-blue-200 rounded-xl shadow-inner max-h-40 overflow-y-auto">
                                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter mb-2">Live Search Preview</p>
                                        <div className="text-xs font-mono leading-relaxed break-all">
                                            <AnnotationHighlight
                                                sequence={editedSequence}
                                                annotations={[{ id: 'temp-find', name: 'FIND MATCH', query: findQuery }]}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Sequence Editor</span>
                                    <textarea
                                        value={editedSequence}
                                        onChange={handleSequenceChange}
                                        spellCheck={false}
                                        className="w-full h-40 p-4 font-mono text-sm bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:bg-white transition-all outline-none resize-none uppercase tracking-widest leading-relaxed"
                                        placeholder="Paste or edit DNA sequence here..."
                                    />
                                </div>

                                {/* DIFF VIEW */}
                                {fileData && editedSequence !== fileData.sequence && (
                                    <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-inner">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-2">Visual Diff (Original vs Corrected)</p>
                                        <div className="flex flex-wrap gap-0.5 font-mono text-xs">
                                            {fileData.sequence.split('').map((base, i) => {
                                                const correctedBase = editedSequence[i];
                                                const isModified = correctedBase && base !== correctedBase;
                                                return (
                                                    <span key={i} className={isModified ? 'text-red-600 font-bold scale-110' : 'text-gray-300'}>
                                                        {correctedBase || base}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-between items-center text-xs text-gray-400 font-medium">
                                    <span>Length: {editedSequence.length} bp</span>
                                    <button
                                        onClick={() => setEditedSequence(fileData?.sequence || '')}
                                        className="text-blue-500 hover:underline"
                                    >
                                        Reset to Original
                                    </button>
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* STEP 6: DOMAIN SEARCH & HIGHLIGHT */}
                    <Card
                        title="6. Domain Search & Highlight"
                        icon={Search}
                        status={searchQuery.length > 1 ? 'completed' : editedSequence ? 'active' : 'pending'}
                    >
                        <p className="mb-4">Identify functional motifs in both DNA and Protein space.</p>
                        {editedSequence && (
                            <div className="space-y-4">
                                {/* BOX 1: SEARCH INPUT */}
                                <div className="p-4 bg-white border-2 border-gray-100 rounded-xl shadow-sm">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Motif Search Query</span>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search motif (e.g. GAATTC)..."
                                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-blue-500 transition-all outline-none uppercase font-mono rounded-lg"
                                        />
                                    </div>
                                </div>

                                {/* BOX 2: SEQUENCE DISPLAY (Corrected DNA + AA) */}
                                <div id="comparison-box" className="grid grid-cols-1 gap-4 p-6 bg-gray-100 rounded-xl shadow-inner border-2 border-gray-200 overflow-hidden">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Corrected DNA Sequence</span>
                                            <div className="flex gap-1">
                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                <div className="w-2 h-2 rounded-full bg-blue-300" />
                                            </div>
                                        </div>
                                        <div className="text-xs font-mono text-gray-800 p-3 bg-white border border-gray-200 rounded-lg max-h-48 overflow-y-auto shadow-sm">
                                            <AnnotationHighlight sequence={editedSequence} annotations={annotations} />
                                        </div>
                                    </div>
                                    <div className="border-t-2 border-dashed border-gray-300 pt-4">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Translated Protein (Frame +{selectedFrame + 1})</span>
                                            <div className="flex gap-1">
                                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                                <div className="w-2 h-2 rounded-full bg-green-300" />
                                            </div>
                                        </div>
                                        <div className="text-xs font-mono text-gray-800 p-3 bg-white border border-gray-200 rounded-lg max-h-32 overflow-y-auto shadow-sm">
                                            <AnnotationHighlight sequence={protein} annotations={annotations.map(a => ({ ...a, query: translate(a.query) }))} />
                                        </div>
                                    </div>
                                </div>

                                {/* BOX 3: DOMAIN NAME INPUT */}
                                {searchQuery.length > 1 ? (
                                    <div className="p-4 bg-blue-600 rounded-xl shadow-lg flex flex-col gap-3">
                                        <span className="text-[10px] font-black text-blue-100 uppercase tracking-widest">New Annotation Details</span>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Enter Domain Name (e.g. Promoter A)"
                                                id="domainNameInput"
                                                className="flex-1 px-4 py-2 bg-white border-none rounded-lg text-sm outline-none focus:ring-4 focus:ring-blue-400 placeholder:text-gray-300"
                                            />
                                            <button
                                                onClick={() => {
                                                    const nameInput = document.getElementById('domainNameInput');
                                                    const newAnn = {
                                                        id: Date.now(),
                                                        name: nameInput.value || 'Untitled Domain',
                                                        query: searchQuery,
                                                        count: searchResults.length
                                                    };
                                                    setAnnotations([...annotations, newAnn]);
                                                    setSearchQuery('');
                                                    nameInput.value = '';
                                                }}
                                                className="px-6 py-2 bg-white text-blue-800 font-black rounded-lg text-sm hover:bg-blue-50 transition-colors shadow-sm"
                                            >
                                                Save Domain
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-gray-100 border border-dashed border-gray-300 rounded-xl text-center text-xs text-gray-400 font-bold uppercase tracking-widest">
                                        Search a motif to enable domain labeling
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* STEP 7: ANNOTATION */}
                    <Card
                        title="7. Annotation"
                        icon={Tag}
                        status={annotations.length > 0 ? 'completed' : searchQuery.length > 1 ? 'active' : 'pending'}
                        id="annotation-step-card"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-sm">Manage identified regions and export your annotated project report.</p>
                            {annotations.length > 0 && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleExportComparisonJpg}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg"
                                    >
                                        <Save className="w-4 h-4" /> Export Annotation
                                    </button>
                                </div>
                            )}
                        </div>
                        {searchQuery.length > 1 && (
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        const newAnn = { id: Date.now(), query: searchQuery, count: searchResults.length };
                                        setAnnotations([...annotations, newAnn]);
                                        setSearchQuery('');
                                    }}
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
                                >
                                    <Tag className="w-5 h-5" /> Save Highlight as Annotation
                                </button>

                                <AnimatePresence>
                                    {annotations.map(ann => (
                                        <motion.div
                                            key={ann.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-200" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-extrabold text-blue-900">{ann.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-[10px] text-gray-500">{ann.query}</span>
                                                        <span className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">({ann.count} sites)</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setAnnotations(annotations.filter(a => a.id !== ann.id))}
                                                className="text-gray-300 hover:text-red-500 transition-colors"
                                            >
                                                &times;
                                            </button>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
