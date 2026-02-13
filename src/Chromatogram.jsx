import React, { useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

export default function Chromatogram({ data, start = 0, length = 100, zoom = 1 }) {
    const chartData = useMemo(() => {
        if (!data || !data.traces) return null;

        const baseOrder = data.baseOrder || 'GATC';
        const colors = {
            'G': 'rgba(0, 0, 0, 1)',      // Black
            'A': 'rgba(34, 197, 94, 1)',  // Green
            'T': 'rgba(239, 68, 68, 1)',  // Red
            'C': 'rgba(59, 130, 246, 1)'  // Blue
        };

        const viewLength = Math.max(10, Math.floor(length / zoom));
        const RFU_THRESHOLD = 50; // Baseline noise reduction

        // 1. DYNAMIC SCALING: Find max value in visible window to auto-scale height
        let globalMax = 200; // Minimum default max
        Object.keys(data.traces).forEach(base => {
            const visibleSlice = data.traces[base].slice(start, start + viewLength);
            const sliceMax = Math.max(...visibleSlice);
            if (sliceMax > globalMax) globalMax = sliceMax;
        });

        // Subtract threshold from globalMax for the scale max
        const scaleMax = Math.max(100, globalMax - RFU_THRESHOLD);

        const datasets = Object.keys(data.traces).map(base => {
            const traceData = data.traces[base];
            const sampledData = Array.from(traceData.slice(start, start + viewLength)).map(val => {
                // Professional Noise Filtering: Subtract baseline and floor at zero
                return Math.max(0, val - RFU_THRESHOLD);
            });

            return {
                label: base,
                data: sampledData,
                borderColor: colors[base] || '#ccc',
                borderWidth: 1.2, // Slightly thinner for "sharper" look
                pointRadius: 0,
                tension: 0.5, // High anti-aliasing/smoothing for professional curves
                fill: false,
                spanGaps: true
            };
        });

        return {
            labels: Array.from({ length: viewLength }, (_, i) => start + i),
            datasets,
            scaleMax, // Pass this to options
        };
    }, [data, start, length, zoom]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        elements: {
            line: {
                capBezierPoints: true // Professional smoothing
            }
        },
        layout: {
            padding: {
                top: 40 // More space for legend/ticks
            }
        },
        scales: {
            x: { display: false },
            y: {
                display: false,
                min: 0,
                max: chartData?.scaleMax || 1000 // Professional "Tall Peaks" scaling
            }
        },
        plugins: {
            legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } },
            tooltip: { enabled: false },
            // Custom plugin to draw professional chromatogram elements
            peakBases: {
                afterDraw: (chart) => {
                    const ctx = chart.ctx;
                    const meta = chart.getDatasetMeta(0);
                    if (!meta) return;

                    const peakData = data.peakLocations;
                    const sequence = data.sequence;
                    const traces = data.traces;

                    ctx.save();
                    ctx.textAlign = 'center';

                    const colors = {
                        'G': '#000000',
                        'A': '#22c55e',
                        'T': '#ef4444',
                        'C': '#3b82f6'
                    };

                    const viewLength = Math.max(10, Math.floor(length / zoom));
                    const rulerY = chart.height - 40;
                    const baseLabelsY = chart.height - 15;

                    // Draw Professional Chromatogram Elements
                    for (let i = 0; i < peakData.length; i++) {
                        let traceIndex = peakData[i];
                        const base = sequence[i];

                        // Check if peak is in current view
                        if (traceIndex >= start && traceIndex <= start + viewLength) {
                            // Professional Centering Calculation
                            const baseTrace = traces[base];
                            if (baseTrace) {
                                let localMaxVisibleIndex = traceIndex;
                                let maxVal = -Infinity;
                                // Window search for perfect centering on peak apex
                                for (let j = Math.max(0, traceIndex - 3); j < Math.min(baseTrace.length, traceIndex + 3); j++) {
                                    if (baseTrace[j] > maxVal) {
                                        maxVal = baseTrace[j];
                                        localMaxVisibleIndex = j;
                                    }
                                }
                                traceIndex = localMaxVisibleIndex;
                            }

                            const x = chart.scales.x.getPixelForValue(traceIndex - start);

                            // 2. High-Contrast Vertical Grid Lines
                            ctx.beginPath();
                            ctx.setLineDash([1, 5]);
                            ctx.strokeStyle = '#f1f5f9'; // Subtle grid
                            ctx.lineWidth = 0.5;
                            ctx.moveTo(x, 40);
                            ctx.lineTo(x, rulerY - 2);
                            ctx.stroke();
                            ctx.setLineDash([]);

                            // 3. Ruler Ticks and Numbering
                            const displayIndex = i + 1;

                            if (displayIndex % 10 === 0) { // Every 10 for cleaner look
                                ctx.strokeStyle = '#94a3b8';
                                ctx.beginPath();
                                ctx.moveTo(x, rulerY);
                                ctx.lineTo(x, rulerY + 8);
                                ctx.stroke();

                                ctx.font = '9px Inter, sans-serif';
                                ctx.fillStyle = '#64748b';
                                ctx.fillText(displayIndex, x, rulerY + 18);
                            } else if (displayIndex % 5 === 0) {
                                ctx.strokeStyle = '#cbd5e1';
                                ctx.beginPath();
                                ctx.moveTo(x, rulerY + 2);
                                ctx.lineTo(x, rulerY + 6);
                                ctx.stroke();
                            }

                            // 4. Base Labels (Professional Monospace alignment)
                            ctx.font = 'bold 12px "Courier New", monospace';
                            ctx.fillStyle = colors[base] || '#666';
                            ctx.fillText(base, x, baseLabelsY);
                        }
                    }

                    // Professional baseline ruler
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(chart.scales.x.left, rulerY + 4);
                    ctx.lineTo(chart.scales.x.right, rulerY + 4);
                    ctx.stroke();

                    ctx.restore();
                }
            }
        }
    };

    if (!chartData) return <div className="p-12 text-center text-gray-400">No trace data available</div>;

    return (
        <div className="h-80 w-full bg-white rounded-lg p-2 border border-gray-100 shadow-sm">
            <Line
                data={chartData}
                options={options}
                plugins={[{
                    id: 'peakBases',
                    afterDraw: options.plugins.peakBases.afterDraw
                }]}
            />
        </div>
    );
}
