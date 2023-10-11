let currentRun = [];
let allRuns = JSON.parse(localStorage.getItem('runs')) || [];
let currentTagIndex = 0;

const CSVFiles = {
    "line2east": "BDEB_Tags.csv",
    "line2west": "BDWB_Tags.csv"
}

// Fetch and parse CSV data
function fetchCSV(filePath) {
    return fetch(filePath)
        .then(response => response.text())
        .then(data => {
            let parsedData = data.split('\n').map(row => row.split(','));
            // Remove header row if exists
            if (parsedData[0][0] === 'tag_id') parsedData.shift();
            return parsedData;
        });
}

function startRun() {
    let runDateElem = document.getElementById('runDate');
    if (!runDateElem) return;  // Exit early if we're not on the main page

    let runDate = runDateElem.value;
    let lineNumber = document.getElementById('lineNumber').value;
    let bound = document.getElementById('bound').value;

    currentRun = {
        date: runDate,
        line: lineNumber,
        bound: bound,
        measurements: []
    };

    currentTagIndex = 0;
    showTag();
}

function showTag() {
    let csvFile = CSVFiles[currentRun.line + currentRun.bound];
    fetchCSV(csvFile).then(tags => {
        if (currentTagIndex < tags.length) {
            let tag = tags[currentTagIndex];
            document.getElementById('currentTagID').innerText = tag[0];
            document.getElementById('currentTagPosition').innerText = tag[8];
            document.getElementById('tagEntrySection').style.display = 'block';
        } else {
            saveAndExit();
        }
    });
}

function saveMeasurement() {
    let reportedPos = document.getElementById('reportedPosition').value;
    let tagID = document.getElementById('currentTagID').innerText;
    currentRun.measurements.push({
        tag: tagID,
        reportedPosition: reportedPos
    });
    currentTagIndex++;
    showTag();
    document.getElementById('reportedPosition').value = '';
}

function skipTag() {
    currentTagIndex++;
    showTag();
}

function saveAndExit() {
    let existingRunIndex = allRuns.findIndex(run => run.date === currentRun.date && run.line === currentRun.line && run.bound === currentRun.bound);

    if (existingRunIndex > -1) {
        allRuns[existingRunIndex] = currentRun;  // Update the existing run
    } else {
        allRuns.push(currentRun);  // Add as a new run
    }

    localStorage.setItem('runs', JSON.stringify(allRuns));
    document.getElementById('tagEntrySection').style.display = 'none';
    // Show the 'Add New Run' section
    document.getElementById('addRunSection').style.display = 'block';
    loadRuns();
}

function calculateAverageOffset(measurements) {
    let totalOffset = 0;
    let validEntries = 0;

    measurements.forEach(measurement => {
        // Ensure we have both reportedPosition and databasePosition
        if (!measurement.reportedPosition || !measurement.databasePosition) return;

        let reported = parseFloat(measurement.reportedPosition);
        let database = parseFloat(measurement.databasePosition);

        // Ensure both values are valid numbers
        if (!isNaN(reported) && !isNaN(database)) {
            const offset = (database - reported) * 100;
            totalOffset += offset;
            validEntries++;
        }
    });

    // If no valid entries, return 'N/A'
    if (validEntries === 0) return 'N/A';

    // Calculate the average
    const averageOffset = totalOffset / validEntries;

    // Return the average rounded to two decimal places
    return averageOffset.toFixed(2);
}

function loadRuns() {
    const runsTableBody = document.getElementById('runsTable').querySelector('tbody');
    runsTableBody.innerHTML = ''; // Clear existing rows

    allRuns.forEach((run, index) => {
        const csvFile = CSVFiles[run.line + run.bound];
        fetchCSV(csvFile).then(tags => {
            // Map the parsed CSV tags with measurements
            run.measurements.forEach(measurement => {
                const tagData = tags.find(tag => tag[0] === measurement.tag);
                if (tagData) {
                    measurement.databasePosition = tagData[8];
                }
            });
            
            const row = runsTableBody.insertRow();

            const dateCell = row.insertCell(0);
            dateCell.textContent = run.date;

            const lineNumberCell = row.insertCell(1);
            const logoImg = document.createElement('img');
            logoImg.src = 'line_2_logo.png';
            logoImg.alt = 'Line Logo';
            logoImg.className = 'logo';
            lineNumberCell.appendChild(logoImg);

            const boundCell = row.insertCell(2);
            if (run.bound === 'east') {
                boundCell.textContent = 'Eastbound';
            } else if (run.bound === 'west') {
                boundCell.textContent = 'Westbound';
            }

            const actionsCell = row.insertCell(3);
            const continueButton = document.createElement('button');
            continueButton.textContent = '❗'; // yellow exclamation point
            continueButton.onclick = function() {
                continueRun(index);
            };

            const avgOffsetCell = row.insertCell(4);  // Assuming this is the 5th column
            avgOffsetCell.textContent = calculateAverageOffset(run.measurements);
            actionsCell.appendChild(continueButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = '❌'; // red x
            deleteButton.onclick = function() {
                if (confirm('Are you sure you want to delete this run?')) {
                    deleteRun(index);
                    loadRuns(); // Refresh the table
                }
            };
            actionsCell.appendChild(deleteButton);
        });
    });
}

function sortTable() {
    console.log("Sorting runs...");  // Debugging line
    allRuns.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);

        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;
        return 0;
    });
    loadRuns(); // Refresh the table with sorted data
}


function continueRun(index) {
    localStorage.setItem('continueRunIndex', index);
    window.location.href = 'index.html';
}

function deleteRun(index) {
    if (confirm('Are you sure?')) {
        allRuns.splice(index, 1);
        localStorage.setItem('runs', JSON.stringify(allRuns));
        loadRuns();
    }
}

function loadAnalysis() {
    allRuns = JSON.parse(localStorage.getItem('runs')) || [];

    // Define the CSV files for Eastbound and Westbound
    const eastCSVFile = CSVFiles["line2east"];
    const westCSVFile = CSVFiles["line2west"];

    function analyzeRuns(direction, csvFile) {
        let problematicTags = [];
        let tagOffsets = {};

        // Fetch and parse the CSV file
        fetchCSV(csvFile).then(tags => {
            allRuns.filter(run => run.bound === direction).forEach(run => {
                run.measurements.forEach(measurement => {
                    // Check if reported position is empty or not a number
                    if (!measurement.reportedPosition || isNaN(parseFloat(measurement.reportedPosition))) {
                        return; // Skip this measurement
                    }

                    const tagData = tags.find(tag => tag[0] === measurement.tag);
                    if (tagData) {
                        const offset = Math.abs((parseFloat(tagData[8]) - parseFloat(measurement.reportedPosition)) * 100);
                        if (tagOffsets[measurement.tag]) {
                            tagOffsets[measurement.tag].push(offset);
                        } else {
                            tagOffsets[measurement.tag] = [offset];
                        }
                    }
                });
            });

            for (let tag in tagOffsets) {
                let avgOffset = tagOffsets[tag].reduce((acc, val) => acc + val, 0) / tagOffsets[tag].length;
                problematicTags.push({ tag: tag, avgOffset: avgOffset });
            }

            problematicTags.sort((a, b) => b.avgOffset - a.avgOffset);

            return problematicTags.slice(0, 5);
        }).then(problematicTags => {
            const containerId = direction === 'east' ? 'eastboundProblems' : 'westboundProblems';

            if (problematicTags.length === 0) {
                document.getElementById(containerId).textContent = 'No runs at this time';
            } else {
                problematicTags.forEach(tagData => {
                    const tagInfo = document.createElement('p');
                    tagInfo.textContent = `Tag: ${tagData.tag}, Average Offset: ${tagData.avgOffset.toFixed(2)} ft`;
                    document.getElementById(containerId).appendChild(tagInfo);
                });
            }
        });
    }

    // Analyze for Eastbound
    analyzeRuns('east', eastCSVFile);

    // Analyze for Westbound
    analyzeRuns('west', westCSVFile);
}
