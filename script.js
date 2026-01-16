// State
const state = {
    data: [],
    patient: {
        Age: 45, Sex: 'M', ChestPainType: 'ATA', RestingBP: 130, Cholesterol: 220, MaxHR: 150, ExerciseAngina: 'N', HeartDisease: 0
    },
    filter: {
        ageRange: null, // {min, max}
        chestPain: null // string
    }
};

// Dimensions & Margins
const margins = { top: 20, right: 20, bottom: 40, left: 50 };

// Init
document.addEventListener('DOMContentLoaded', () => {
    initListeners();
    // Try auto-load
    loadCSV('heart.csv'); // Relative to dashboard folder
});

function initListeners() {
    // Form Inputs
    const inputs = ['Age', 'Sex', 'ChestPainType', 'RestingBP', 'Cholesterol', 'MaxHR', 'ExerciseAngina', 'HeartDisease'];
    inputs.forEach(id => {
        const el = document.getElementById('in_' + id);
        if (el) {
            el.addEventListener('input', (e) => {
                let val = e.target.value;
                if (e.target.type === 'number') val = parseFloat(val);
                if (id === 'HeartDisease') val = parseInt(val); // Ensure Integer
                state.patient[id] = val;
                updateDashboard();
            });
        }
    });

    // Add Patient Button
    const btnAdd = document.getElementById('btnAddPatient');
    if (btnAdd) {
        btnAdd.addEventListener('click', addPatientToData);
    }

    // File Upload
    const fileInput = document.getElementById('csvUpload');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) parseFile(e.target.files[0]);
        });
    }

    // Initialize Tooltip
    if (!document.getElementById('d3-tooltip')) {
        const tooltip = document.createElement('div');
        tooltip.id = 'd3-tooltip';
        tooltip.className = 'd3-tooltip';
        document.body.appendChild(tooltip);
    }
}

function loadCSV(path) {
    Papa.parse(path, {
        download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
        complete: (results) => {
            console.log('Data loaded', results);
            state.data = results.data;
            document.getElementById('totalRecords').textContent = state.data.length;
            updateDashboard();
        },
        error: () => console.warn('Auto-load failed')
    });
}

function parseFile(file) {
    Papa.parse(file, {
        header: true, dynamicTyping: true, skipEmptyLines: true,
        complete: (results) => {
            state.data = results.data;
            document.getElementById('totalRecords').textContent = state.data.length;
            updateDashboard();
        }
    });
}

function addPatientToData() {
    // Clone patient data
    const newEntry = { ...state.patient };

    // Add to dataset
    state.data.push(newEntry);

    // Update UI
    document.getElementById('totalRecords').textContent = state.data.length;

    updateDashboard();

    // Feedback
    const btn = document.getElementById('btnAddPatient');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="check"></i><span>Added!</span>`;
    btn.style.backgroundColor = '#10b981'; // Green

    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.backgroundColor = ''; // Reset
        lucide.createIcons();
    }, 1500);
}

function updateDashboard() {
    if (state.data.length === 0) return;

    // Calc Diff
    const avgChol = mean(state.data.map(d => d.Cholesterol));
    const avgHR = mean(state.data.map(d => d.MaxHR));

    const cholDiff = state.patient.Cholesterol - avgChol;
    const hrDiff = state.patient.MaxHR - avgHR;

    document.getElementById('cholDiff').textContent = (cholDiff > 0 ? '+' : '') + cholDiff.toFixed(0);
    document.getElementById('cholDiff').style.color = cholDiff > 50 ? '#ef4444' : '#10b981';

    document.getElementById('hrDiff').textContent = (hrDiff > 0 ? '+' : '') + hrDiff.toFixed(0);

    // Risk Label (Simplified logic for demo)
    let risk = "Low Risk";
    if (state.patient.Cholesterol > 240 || state.patient.RestingBP > 140) risk = "Moderate Risk";
    if (state.patient.Cholesterol > 280 || (state.patient.Age > 60 && state.patient.RestingBP > 150)) risk = "High Risk";

    const riskLabel = document.getElementById('riskLabel');
    riskLabel.textContent = risk;
    riskLabel.style.color = risk === 'High Risk' ? '#ef4444' : (risk === 'Moderate Risk' ? '#f59e0b' : '#10b981');

    renderScatter();
    renderDistChart('Cholesterol', 'cholChart');
    renderDistChart('Age', 'ageChart', true);
    renderPieChart();
}

/**
 * Render Scatter Plot (Age vs MaxHR)
 */
function renderScatter() {
    const containerId = 'scatterChart';
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clear previous

    const width = container.clientWidth;
    const height = container.clientHeight || 450;
    const w = width - margins.left - margins.right;
    const h = height - margins.top - margins.bottom;

    const svg = d3.select('#' + containerId)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${margins.left},${margins.top})`);

    // Filter Data
    let filteredData = state.data;
    if (state.filter.ageRange) {
        filteredData = filteredData.filter(d => d.Age >= state.filter.ageRange.min && d.Age < state.filter.ageRange.max);
    }
    if (state.filter.chestPain) {
        filteredData = filteredData.filter(d => d.ChestPainType === state.filter.chestPain);
    }

    // Scales
    const x = d3.scaleLinear()
        .domain([20, 80]) // Fixed domain for stability or d3.extent(state.data, d => d.Age)
        .range([0, w]);

    const y = d3.scaleLinear()
        .domain([60, 220]) // Fixed domain or d3.extent(state.data, d => d.MaxHR)
        .range([h, 0]);

    // Axes
    svg.append('g')
        .attr('transform', `translate(0,${h})`)
        .call(d3.axisBottom(x).ticks(5))
        .attr('color', '#94a3b8');

    svg.append('g')
        .call(d3.axisLeft(y).ticks(5))
        .attr('color', '#94a3b8');

    // Add Dots
    // Existing Data
    svg.selectAll('.dot')
        .data(filteredData)
        .enter()
        .append('circle')
        .attr('cx', d => x(d.Age))
        .attr('cy', d => y(d.MaxHR))
        .attr('r', 4)
        .attr('fill', d => d.HeartDisease === 1 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)')
        .on('mouseover', function (event, d) {
            showTooltip(event, `Age: ${d.Age}<br>HR: ${d.MaxHR}<br>Disease: ${d.HeartDisease ? 'Yes' : 'No'}`);
            d3.select(this).attr('r', 6).attr('stroke', '#fff');
        })
        .on('mouseout', function () {
            hideTooltip();
            d3.select(this).attr('r', 4).attr('stroke', 'none');
        });

    // Patient Dot
    svg.append('circle')
        .attr('cx', x(state.patient.Age))
        .attr('cy', y(state.patient.MaxHR))
        .attr('r', 10)
        .attr('fill', '#f43f5e')
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .on('mouseover', (event) => showTooltip(event, `YOU<br>Age: ${state.patient.Age}<br>HR: ${state.patient.MaxHR}`))
        .on('mouseout', hideTooltip);

    // Patient Label
    svg.append('text')
        .attr('x', x(state.patient.Age))
        .attr('y', y(state.patient.MaxHR) - 15)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text('YOU');
}

/**
 * Render Distribution Chart (Histogram)
 */
function renderDistChart(metric, containerId, isInteractive = false) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const width = container.clientWidth;
    const height = container.clientHeight || 200;
    const margin = { top: 10, right: 10, bottom: 20, left: 10 }; // Minimized margins for small charts
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select('#' + containerId)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare Data
    const values = state.data.map(d => d[metric]);
    const min = d3.min(values);
    const max = d3.max(values);

    const x = d3.scaleLinear()
        .domain([min, max])
        .range([0, w]);

    const histogram = d3.bin()
        .domain(x.domain())
        .thresholds(x.ticks(15));

    const bins = histogram(values);

    const y = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)])
        .range([h, 0]);

    // Find Patient Bin
    const patVal = state.patient[metric];

    // Bars
    svg.selectAll('rect')
        .data(bins)
        .enter()
        .append('rect')
        .attr('x', 1)
        .attr('transform', d => `translate(${x(d.x0)},${y(d.length)})`)
        .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
        .attr('height', d => h - y(d.length))
        .attr('fill', d => (patVal >= d.x0 && patVal < d.x1) ? '#f43f5e' : 'rgba(148, 163, 184, 0.3)')
        .attr('rx', 2)
        .style('cursor', isInteractive ? 'pointer' : 'default')
        .on('mouseover', function (event, d) {
            if (isInteractive) d3.select(this).attr('fill', '#94a3b8');
        })
        .on('mouseout', function (event, d) {
            const isPatient = (patVal >= d.x0 && patVal < d.x1);
            // Restore color
            d3.select(this).attr('fill', isPatient ? '#f43f5e' : 'rgba(148, 163, 184, 0.3)');
        })
        .on('click', function (event, d) {
            if (!isInteractive) return;

            // Toggle Filter
            const range = { min: d.x0, max: d.x1 };
            if (state.filter.ageRange && state.filter.ageRange.min === range.min) {
                state.filter.ageRange = null;
            } else {
                state.filter.ageRange = range;
            }
            renderScatter();
        });

    // Simple Axis (Bottom only)
    svg.append('g')
        .attr('transform', `translate(0,${h})`)
        .call(d3.axisBottom(x).ticks(5).tickSize(0).tickPadding(5))
        .attr('color', 'transparent') // Hide axis line
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .style('font-size', '10px');
}

/**
 * Render Pie Chart
 */
function renderPieChart() {
    const containerId = 'pieChart';
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const width = container.clientWidth;
    const height = container.clientHeight || 200;
    const radius = Math.min(width, height) / 2 - 10;

    const svg = d3.select('#' + containerId)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    // Aggregate Data
    const counts = {};
    state.data.forEach(d => {
        const type = d.ChestPainType || 'Unknown';
        counts[type] = (counts[type] || 0) + 1;
    });

    // Sorting to ensure consistent colors
    const data = Object.entries(counts).map(([key, value]) => ({ key, value }));

    // Color Palette
    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.key))
        .range(['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']);

    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(radius * 0.5) // Doughnut
        .outerRadius(radius);

    const arcHover = d3.arc()
        .innerRadius(radius * 0.5)
        .outerRadius(radius + 5);

    // Draw
    const paths = svg.selectAll('path')
        .data(pie(data))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.key))
        .attr('stroke', '#1e293b')
        .style('stroke-width', '2px')
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
            d3.select(this).transition().duration(200).attr('d', arcHover);
            showTooltip(event, `${d.data.key}: ${d.data.value}`);
        })
        .on('mouseout', function () {
            d3.select(this).transition().duration(200).attr('d', arc);
            hideTooltip();
        })
        .on('click', function (event, d) {
            const type = d.data.key;
            // Toggle Filter
            if (state.filter.chestPain === type) {
                state.filter.chestPain = null;
                d3.select(this).style('opacity', 1);
            } else {
                state.filter.chestPain = type;
                // Dim others
                svg.selectAll('path').style('opacity', 0.3);
                d3.select(this).style('opacity', 1);
            }
            // If clearing filter, reset opacity
            if (!state.filter.chestPain) {
                svg.selectAll('path').style('opacity', 1);
            }
            renderScatter();
        });

    // Legend (Simplified side legend)
    // In D3, legends are manual. For now, tooltips suffice, or we use the colors.
}

// Tooltip Helpers
function showTooltip(event, html) {
    const tooltip = document.getElementById('d3-tooltip');
    tooltip.innerHTML = html;
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY + 10) + 'px';
    tooltip.style.opacity = 1;
}

function hideTooltip() {
    const tooltip = document.getElementById('d3-tooltip');
    tooltip.style.opacity = 0;
}

function mean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}
