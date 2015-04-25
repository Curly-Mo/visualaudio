var context;
var source;
var audio_buffer;
var analyser;
var is_playing = false;
window.start_time = 0;
window.pause_time = 0;

var analyser2;
var scriptProcessor2;

var ctx_spectrum;
var gradient;

var ctx_spectrogram;
var tempCtx;

var ctx_oscilloscope;

var ctx_waveform;
var scriptProcesser4;
var waveform_x = 0;
var waveform_y = 150;

var ctx_cepstrum;

window.addEventListener('load', init, false);
function init() {
    try {
        window.AudioContext = window.AudioContext||window.webkitAudioContext;
        context = new AudioContext();
    }
    catch(e) {
        alert('Web Audio API is not supported in this browser');
    }
    finally{
        //var audio = document.getElementById('player');
        //source = context.createBufferSource();
        //source.connect(context.destination);

        analyser = context.createAnalyser();
        analyser.smoothingTimeConstant = 0.3;
        analyser.fftSize = 1024;
        analyser.connect(context.destination);

        analyser2 = context.createAnalyser();
        analyser2.smoothingTimeConstant = 0;
        analyser2.fftSize = 1024;

        initCanvas();
        document.getElementById('local_file').addEventListener('change', handleFileSelect, false);
        document.getElementById('fft_size').addEventListener('change', fftSizeChange, false);
        document.getElementById('loop').addEventListener('change', loopClick, false);
    }
}

function initCanvas() {
    var canvas = document.getElementById('spectrum');
    ctx_spectrum = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    //canvas.width = window.innerWidth;
    gradient = ctx_spectrum.createLinearGradient(0,0,0,canvas.height);
    gradient.addColorStop(1,'#000000');
    gradient.addColorStop(0.85,'#ff0000');
    gradient.addColorStop(0.35,'#ffff00');
    gradient.addColorStop(0,'#ffffff');

    scriptProcessor = context.createScriptProcessor(1024);
    scriptProcessor.connect(context.destination);
    analyser.connect(scriptProcessor);
    scriptProcessor.onaudioprocess = drawSpectrum;

    var canvas2 = document.getElementById('spectrogram');
    ctx_spectrogram = canvas2.getContext('2d');
    canvas2.width = canvas2.offsetWidth;
    canvas2.height = canvas2.offsetHeight;

    var tempCanvas = document.createElement("canvas");
    tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width=canvas2.width;
    tempCanvas.height=canvas2.height;

    scriptProcessor2 = context.createScriptProcessor(1024);
    scriptProcessor2.connect(context.destination);
    analyser2.connect(scriptProcessor2);
    scriptProcessor2.onaudioprocess = drawSpectrogram;

    var canvas3 = document.getElementById('oscilloscope');
    ctx_oscilloscope = canvas3.getContext('2d');
    canvas3.width = canvas3.offsetWidth;
    canvas3.height  = canvas3.offsetHeight;
    scriptProcessor3 = context.createScriptProcessor(1024);
    scriptProcessor3.connect(context.destination);
    analyser2.connect(scriptProcessor3);
    scriptProcessor3.onaudioprocess = drawOscilloscope;

    var canvas4 = document.getElementById('waveform');
    ctx_waveform = canvas4.getContext('2d');
    canvas4.width  = canvas4.offsetWidth;
    canvas4.height = canvas4.offsetHeight;
    scriptProcessor4 = context.createScriptProcessor(1024);
    scriptProcessor4.connect(context.destination);
    analyser2.connect(scriptProcessor4);
    scriptProcessor4.onaudioprocess = drawWaveform;

    var canvas5 = document.getElementById('cepstrum');
    ctx_cepstrum = canvas5.getContext('2d');
    canvas5.width  = canvas5.offsetWidth;
    canvas5.height  = canvas5.offsetHeight;
    scriptProcessor5 = context.createScriptProcessor(2048);
    scriptProcessor5.connect(context.destination);
    analyser.connect(scriptProcessor5);
    scriptProcessor5.onaudioprocess = drawCepstrum;
}

function drawOscilloscope() {
    var array = new Uint8Array(analyser2.frequencyBinCount);
    analyser2.getByteTimeDomainData(array);
    var canvas = ctx_oscilloscope.canvas;
    ctx_oscilloscope.clearRect(0,0,canvas.width,canvas.height);

    binWidth = (canvas.width)/(analyser2.frequencyBinCount-1);
    ctx_oscilloscope.lineWidth = 3;
    ctx_oscilloscope.strokeStyle = 'rgb(255, 255, 255)';
    ctx_oscilloscope.beginPath();
    for (var i = 0; i < array.length; i++) {
            var value = array[i] / 256;
            x = i*binWidth;
            y = value * canvas.height;
            if(i === 0) {
                ctx_oscilloscope.moveTo(x, y);
            } else {
                ctx_oscilloscope.lineTo(x, y);
            }
    }
    //ctx_oscilloscope.lineTo(canvas.width, canvas.height/2);
    ctx_oscilloscope.stroke();
};

function drawWaveform() {
    if(!is_playing){
    //if (document.getElementById('player').paused){
        return;
    }
    var array = new Uint8Array(analyser2.frequencyBinCount);
    analyser2.getByteTimeDomainData(array);
    var canvas = ctx_waveform.canvas;

    //audioDuration = document.getElementById('player').duration;
    audioDuration = audio_buffer.duration;
    //totalSamples = audioDuration * context.sampleRate;
    totalSamples = audio_buffer.length;
    timeBinWidth = (canvas.width)/(totalSamples/scriptProcessor4.bufferSize);
    if(isNaN(timeBinWidth)){
        return;
    }

    ctx_waveform.lineWidth = 1;
    ctx_waveform.strokeStyle = 'rgb(255, 255, 255)';
    ctx_waveform.beginPath();
    ctx_waveform.moveTo(waveform_x, waveform_y);
    for (var i = 0; i < array.length; i++) {
        var value = array[Math.floor(i)] / 256;
        waveform_x += timeBinWidth/array.length;
        if (waveform_x > canvas.width){
            waveform_x = 0;
            ctx_waveform.clearRect(0,0,canvas.width,canvas.height);
            ctx_waveform.moveTo(waveform_x, waveform_y);
        }
        waveform_y = value * canvas.height;
        ctx_waveform.lineTo(waveform_x, waveform_y);
    }
    ctx_waveform.stroke();
};

function drawSpectrum() {
    var array =  new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    ctx_spectrum.clearRect(0, 0, ctx_spectrum.canvas.width, ctx_spectrum.canvas.height);
    ctx_spectrum.fillStyle=gradient;
    for ( var i = 0; i < (array.length); i++ ){
        var value = ctx_spectrum.canvas.height*array[i]/256;
        var binWidth = ctx_spectrum.canvas.width/analyser.frequencyBinCount;
        ctx_spectrum.fillRect(i*binWidth,ctx_spectrum.canvas.height,binWidth*3/4,-value);
    }
};

function drawSpectrogram() {
    if (!is_playing) {
    //if (document.getElementById('player').paused){
            return;
    }
    //Copy current canvas to temp canvas
    canvas = ctx_spectrogram.canvas;
    tempCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height);

    var array = new Uint8Array(analyser2.frequencyBinCount);
    analyser2.getByteFrequencyData(array);

    //audioDuration = document.getElementById('player').duration;
    audioDuration = audio_buffer.duration;
    //totalSamples = audioDuration * context.sampleRate;
    totalSamples = audio_buffer.length;
    timeBinWidth = canvas.width/(totalSamples/scriptProcessor2.bufferSize);
    timeBinWidth = Math.max(timeBinWidth, 1);
    freqBinWidth = canvas.height/analyser2.frequencyBinCount;

    for (var i = 0; i < array.length; i++) {
            var value = array[i];
            // draw the line at the right side of the canvas
            ctx_spectrogram.fillStyle = "#" + value.toString(16)+value.toString(16)+value.toString(16);
            //ctx_spectrogram.fillStyle = 'hsl(' + (256-value) + ',100%,50%)';
            
            ctx_spectrogram.fillRect(canvas.width - timeBinWidth, canvas.height - i*freqBinWidth, timeBinWidth, canvas.height/array.length);
    }
    ctx_spectrogram.translate(-timeBinWidth, 0);
    ctx_spectrogram.drawImage(tempCtx.canvas, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    ctx_spectrogram.setTransform(1, 0, 0, 1, 0, 0);
};

function drawCepstrum() {
    if (!is_playing) {
            return;
    }
    var array =  new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);

    var data = new complex_array.ComplexArray(array.length);
    data.map(function(value, i, n) {
        value.real = array[i];
    })
    data.FFT();
    mag_array = data.magnitude();

    ctx_cepstrum.clearRect(0, 0, ctx_cepstrum.canvas.width, ctx_cepstrum.canvas.height);
    ctx_cepstrum.fillStyle=gradient;
    for ( var i = 1; i < (mag_array.length/2); i++ ){
        var value = ctx_cepstrum.canvas.height*mag_array[i]/256;

        var binWidth = ctx_cepstrum.canvas.width/(analyser.frequencyBinCount/2);
        ctx_cepstrum.fillRect(i*binWidth,ctx_cepstrum.canvas.height,binWidth*3/4,-value);
    }
};

$(document).ready(function(){

    $('#file_form').hide();  
    $('#tab-nav li').click(function(e) {
        $('.form').hide();
        $('#tab-nav .current').removeClass("current");
        $(this).addClass('current');
        
        var clicked = $(this).find('a:first').attr('href');
        $(clicked).fadeIn('fast');
        e.preventDefault();
    }).eq(0).addClass('current');


    $('#file_form').submit(function () {
        // var file = $("#`cal_file").val();
        // var audio_object = window.createObjectURL(file); 
        // var audio = document.createElement('audio');
        // audio.setAttribute('src', file);
        // audio.play();
        // var audio = document.getElementById('player');
        // audio.currentTime=0;
        // audio.play();
        if (is_playing){
            source.stop();
        } else {
            start_audio(audio_buffer, 0);
        }
        return false;
    });


    $('#tts_form').submit(function () {
        if (is_playing){
            source.stop();
        } else {
            var lang = $.trim($("#language").val());
            var lyrics = $.trim($("#lyrics").val());

            var url = '/tts?' + "&lang=" + encodeURIComponent(lang) + "&q=" + encodeURIComponent(lyrics);
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';

            xhr.onload = function(e) {
                if (this.status == 200) {
                    context.decodeAudioData(xhr.response, start_audio);
                }
            };
            xhr.send();

            // var audio = document.getElementById('player');
            // audio.setAttribute('src', src);
            // audio.play();
        }
        return false;
    });

    $(document).on('keypress', function(e) {
        var tag = e.target.tagName.toLowerCase();
        if ( e.which === 32 && tag != 'input' && tag != 'textarea'){
            if(is_playing){
                source.stop(0);
            }else{
                start_audio(audio_buffer, 0);
            }
            // var audio = document.getElementById('player');
            // if (audio.paused) {
            //       audio.play();
            // } else {
            //       audio.pause();
            // }
        }
    });

});

function handleFileSelect(evt) {
    var files = evt.target.files; // FileList object
    var file = files[0];
    var reader = new FileReader();
    // Closure to capture the file information.
    reader.onload = (function(theFile) {
        return function(e) {
            context.decodeAudioData(e.target.result, start_audio);
            // playSound(e.target.result);
            // var audio = document.getElementById('player');
            // audio.setAttribute('src', e.target.result);
            // audio.play();
        };
    })(file);
    reader.readAsArrayBuffer(file);
}

function loopClick(evt){
    //var audio = document.getElementById('player');
    //audio.loop = checkboxElement.checked;
    if (source){
        source.loop = evt.target.checked;
    }
}

function fftSizeChange(evt){
    var newValue = evt.target.value;
    analyser.fftSize = newValue;
    analyser2.fftSize = newValue;
}

function start_audio(audioBuffer, start_time){
    if (typeof audioBuffer !== 'undefined') {
        audio_buffer = audioBuffer;
    }
    if (typeof start_time == 'undefined') {
        start_time = 0;
    }
    if (start_time == 0){
        waveform_x = 0;
        ctx_waveform.clearRect(0,0,ctx_waveform.canvas.width,ctx_waveform.canvas.height);
    }
    source = context.createBufferSource();
    source.connect(analyser);
    source.connect(analyser2);
    source.buffer = audio_buffer;
    source.start(0,start_time);
    is_playing = true;
    $('.button').val('\u00A0\u258C\u258C');
    if ($('#loop').is(":checked")){
            source.loop = true;
    }
    source.onended = function() {
        is_playing = false;
        $('.button').val('\u25BA');
    }
}
