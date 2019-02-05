$ = document.querySelector.bind(document);
function plot(data) {
  return new Promise((resolve, reject) => {
    var plotRoot = document.createElement("div");
    plotRoot.style.width = "1000px";
    plotRoot.style.height = "1000px";

    var load = {
      x: data.time,
      y: data.load,
      name: "Load",
      yaxis: "y1",
      type: "scatter"
    }

    var end = data.time[data.time.length - 1];
    var mean = {
      x: [0, end],
      y: [data.mean, data.mean],
      name: "Mean",
      yaxis: "y3",
      type: "scatter"
    }
    var median = {
      x: [0, end],
      y: [data.median, data.median],
      name: "Median",
      yaxis: "y4",
      type: "scatter"
    }
    var stddev = {
      x: [0, end, end, 0],
      y: [data.mean + data.stddev, data.mean+data.stddev, data.mean - data.stddev, data.mean - data.stddev],
      fill: 'toself',
      fillcolor: 'rgba(0, 0, 0, 0.3)',
      hoverinfo: 'stddev',
      hoveron: 'fills',
      mode: 'none',
      name: "Standard deviation",
    }

    var graphSeries = [
      load,
      mean,
      median,
      stddev
    ];

    var layout = {
      title: 'Audio callback load analysis',
      xaxis: {
        exponentformat: "none"
      },
      yaxis: {
        title: 'Load',
        rangemode: 'nonnegative',
        autorange: false,
        fixedrange: true,
        range: [0, 2]
      },
      yaxis3: {
        overlaying: 'y',
        autorange: false,
        fixedrange: true,
        rangemode: 'nonnegative',
        range: [0, 2]
      },
      yaxis3: {
        overlaying: 'y',
        autorange: false,
        fixedrange: true,
        rangemode: 'nonnegative',
        range: [0, 2]
      },
      yaxis4: {
        overlaying: 'y',
        autorange: false,
        fixedrange: true,
        rangemode: 'nonnegative',
        range: [0, 2]
      }
    };

    Plotly.newPlot(plotRoot, graphSeries, layout);
    document.body.appendChild(plotRoot);
    resolve(data);
  });
}
function parse(str) {
  return new Promise((resolve, reject) => {
    var len = str.length;
    str = str.trim();
    if (str[str.length - 1] != ']') {
      if (str[str.length - 1] == ',') {
        str = str.substr(0, str.length - 1);
      }
      str += ']';
    }

    var events = JSON.parse(str);

    var numCallbacks = 0;
    for (var i = 0; i < events.length; i++) {
      if (events[i].ph == "X") {
        numCallbacks++;
      }
    }

    var result = {
      time: new Int32Array(numCallbacks),
      load: new Float32Array(numCallbacks),
      budget: new Int32Array(numCallbacks),
      data_underrun: []
    }

    var phaseCallback = "B";
    var startTime = 0;

    var metricIndex = 0;

    for (var i = 0; i < events.length; i++) {
      if (events[i].name.indexOf("budget") != -1) {
        result.budget[metricIndex] = events[i].dur;
        result.time[metricIndex] = events[i].ts;
      }
      if (events[i].name.indexOf("underrun") != -1) {
        console.log(events[i]);
        result.data_underrun.push({ ts: events[i].ts, dropped: parseInt(events[i].comment)});
      }
      if (events[i].name.indexOf("DataCallback") != -1) {
        if (events[i].ph == phaseCallback) {
          if (phaseCallback == "B") {
            phaseCallback = "E";
          } else {
            phaseCallback = "B";
          }
          if (events[i].ph == "E") {
            result.load[metricIndex] = (events[i].ts - result.time[metricIndex]) / result.budget[metricIndex];
            metricIndex++;
          }
        } else {
          throw `Error event ${i}`
        }
      }
    }

    resolve(result);
  });
}
window.onload = function() {
  $('#data-file-input').onchange = function(e) {
    var file = e.target.files[0];
    var fr = new FileReader();
    fr.readAsText(file);
    fr.onload = function() {
      parse(fr.result).then(function(data) {
        return new Promise((resolve, reject) => {
          var load = data.load;
          var len = data.load.length;

          document.body.innerHTML += `${data.data_underrun.length} data underruns<ul>`

          data.data_underrun.forEach(function(e) {
            document.body.innerHTML += `<li>${e.dropped} frames dropped at ${e.ts}`;
          });
          document.body.innerHTML += "</ul>";
          // Median
          var copyLoad = load.slice(0);
          copyLoad.sort((a, b) => a - b);
          var median = copyLoad[Math.floor(copyLoad.length / 2)];

          // Mean
          var sum = 0;
          for (var i = 0; i < len; i++) {
            sum += load[i];
          }
          var mean = sum / len;

          // Variance
          var variance = 0;
          for (var i = 0; i < len; i++) {
            variance += Math.pow(load[i] - mean, 2);
          }
          variance /= len;

          // Standard deviation
          stddev = Math.sqrt(variance);

          var metricsRoot = document.createElement("div");
          metricsRoot.innerHTML = `
          <ul>
          <li> Mean: ${mean}
          <li> Median: ${median}
          <li> Variance: ${variance}
          <li> Standard deviation: ${stddev}
          </ul>
          `;
          document.body.appendChild(metricsRoot);

          data.mean = mean;
          data.variance = variance;
          data.stddev = stddev;
          data.median = median;

          resolve(data);
        });
      }).then(plot);
    }
  }
}
