var context;
var source;
var audio_buffer;
var analyser;
var is_playing = false;
var is_playing_buffer = false;
var is_playing_osc = false;
var is_playing_mic = false;
var pre_gain;
var post_gain;
var source_node = {};
var dest_node = {};
window.start_time = 0;
window.pause_time = 0;

var analyser2;
var scriptProcessor2;

var ctx_spectrum;

var ctx_spectrogram;
var tempCtx;

var ctx_oscilloscope;

var ctx_waveform;
var scriptProcesser4;
var waveform_x = 0;
var waveform_y = 150;

var ctx_cepstrum;

var num_plots = 5;
var num_oscillators = 0;
var oscillators = {};
var osc_gains = {};

//Effects
var effects = {};

var max_delay = 5.0;

var microphone;

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

        pre_gain = context.createGain();
        post_gain = context.createGain();
        pre_gain.connect(post_gain);
        post_gain.connect(context.destination);

        source_node['node'] = pre_gain
        dest_node['node'] = post_gain;
        initEffects(pre_gain, post_gain);

        source_node['dest'] = dest_node;
        dest_node['source'] = source_node;

        analyser = context.createAnalyser();
        analyser.smoothingTimeConstant = 0.3;
        analyser.fftSize = 2048;
        post_gain.connect(analyser);

        analyser2 = context.createAnalyser();
        analyser2.smoothingTimeConstant = 0;
        analyser2.fftSize = 2048;
        post_gain.connect(analyser2);

        initCanvas();
        document.getElementById('local_file').addEventListener('change', handleFileSelect, false);
        document.getElementById('fft_size').addEventListener('change', fftSizeChange, false);
        document.getElementById('loop').addEventListener('change', loopClick, false);

    }
    navigator.getUserMedia = navigator.getUserMedia ||
                             navigator.webkitGetUserMedia ||
                             navigator.mozGetUserMedia ||
                             navigator.msGetUserMedia;
}

function initEffects() {
    var filter = {};
    filter['node'] = context.createBiquadFilter();
    effects['filter'] = filter;

    var compressor = {};
    compressor['node'] = context.createDynamicsCompressor();
    compressor['node'].reduction.value = 0;
    effects['compressor'] = compressor;

    var delay = {};
    delay['node'] = context.createDelay(max_delay);
    effects['delay'] = delay;

    var convolver = {};
    convolver['node'] = context.createConvolver();
    effects['convolver'] = convolver;
    load_convolution_buffer('audio/Hall.wav');
}

function load_convolution_buffer(filename) {
    ajaxRequest = new XMLHttpRequest();
    ajaxRequest.open('GET', filename, true);
    ajaxRequest.responseType = 'arraybuffer';

    ajaxRequest.onload = function() {
      var audioData = ajaxRequest.response;
      context.decodeAudioData(audioData, function(buffer) {
          effects['convolver']['node'].buffer = buffer;
        }, function(e){"Error with decoding audio data" + e.err});
    }

    ajaxRequest.send();
}

function initCanvas() {
    var canvas = document.getElementById('spectrum');
    ctx_spectrum = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    scriptProcessor = context.createScriptProcessor(512);
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

    scriptProcessor2 = context.createScriptProcessor(512);
    scriptProcessor2.connect(context.destination);
    analyser2.connect(scriptProcessor2);
    scriptProcessor2.onaudioprocess = drawSpectrogram;

    var canvas3 = document.getElementById('oscilloscope');
    ctx_oscilloscope = canvas3.getContext('2d');
    canvas3.width = canvas3.offsetWidth;
    canvas3.height  = canvas3.offsetHeight;
    scriptProcessor3 = context.createScriptProcessor(512);
    scriptProcessor3.connect(context.destination);
    analyser2.connect(scriptProcessor3);
    scriptProcessor3.onaudioprocess = drawOscilloscope;

    var canvas4 = document.getElementById('waveform');
    ctx_waveform = canvas4.getContext('2d');
    canvas4.width  = canvas4.offsetWidth;
    canvas4.height = canvas4.offsetHeight;
    scriptProcessor4 = context.createScriptProcessor(512);
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
    if (!document.getElementById("oscilloscope")){
        return;
    }
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
    if(!is_playing || !document.getElementById("waveform")){
    //if (document.getElementById('player').paused){
        return;
    }
    var array = new Uint8Array(analyser2.frequencyBinCount);
    analyser2.getByteTimeDomainData(array);
    var canvas = ctx_waveform.canvas;

    if (audio_buffer) {
        totalSamples = audio_buffer.length;
    }else{
        totalSamples = 999999;
    }
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
    if (!document.getElementById("spectrum")){
        return;
    }
    var array =  new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    ctx_spectrum.clearRect(0, 0, ctx_spectrum.canvas.width, ctx_spectrum.canvas.height);
    ctx_spectrum.fillStyle=make_gradient(ctx_spectrum);
    for ( var i = 0; i < (array.length); i++ ){
        var value = ctx_spectrum.canvas.height*array[i]/256;
        var binWidth = ctx_spectrum.canvas.width/analyser.frequencyBinCount;
        ctx_spectrum.fillRect(i*binWidth,ctx_spectrum.canvas.height,binWidth*3/4,-value);
    }
};

function drawSpectrogram() {
    if (!is_playing || !document.getElementById("spectrogram")) {
    //if (document.getElementById('player').paused){
        return;
    }
    //Copy current canvas to temp canvas
    canvas = ctx_spectrogram.canvas;
    tempCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height);

    var array = new Uint8Array(analyser2.frequencyBinCount);
    analyser2.getByteFrequencyData(array);

    if (is_playing_buffer) {
        audioDuration = audio_buffer.duration;
        totalSamples = audio_buffer.length;
    }else{
        audioDuration = 1;
        totalSamples = 999999;
    }
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
    if (!is_playing || !document.getElementById("cepstrum")) {
            return;
    }
    var array =  new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    var binWidth = ctx_cepstrum.canvas.width/(analyser.frequencyBinCount/2);

    var data = new complex_array.ComplexArray(array.length);
    data.map(function(value, i, n) {
        value.real = array[i];
    })
    data.FFT();
    mag_array = data.magnitude();

    ctx_cepstrum.clearRect(0, 0, ctx_cepstrum.canvas.width, ctx_cepstrum.canvas.height);
    ctx_cepstrum.fillStyle=make_gradient(ctx_cepstrum);
    for ( var i = 1; i < (mag_array.length/2); i++ ){
        var value = 20 * Math.log(mag_array[i]) / Math.LN10;

        ctx_cepstrum.fillRect((i-1)*binWidth,ctx_cepstrum.canvas.height,binWidth*3/4,-value);
    }
};

$(document).ready(function(){

    $('.form').hide();  
    $('#tts_form').show();  
    $('#tab-nav li').click(function(e) {
        $('.form').hide();
        $('#tab-nav .current').removeClass("current");
        $(this).addClass('current');
        
        var clicked = $(this).find('a:first').attr('href');
        $(clicked).fadeIn('fast');
        e.preventDefault();

        // Enable Mic
        if ($(this).find('a:first').attr('href') == "#mic") {
            if (!microphone) {
                var errorCallback = function(e) {
                  alert("Microphone disabled");
                };
                try {
                    navigator.getUserMedia({audio: true}, function(stream) {
                      microphone = context.createMediaStreamSource(stream);
                      microphone.connect(pre_gain);
                    }, errorCallback);
                }
                catch(e) {
                    alert('Microphone is not supported in this browser');
                }
            }else{
                microphone.connect(pre_gain);
            }
            is_playing_mic = true;
            is_playing = true;
        // Disable Mic
        } else {
            if (microphone) {
                microphone.disconnect();
                is_playing_mic = false;
                if (!is_playing_osc && !is_playing_buffer) {
                    is_playing = false;
                }
            }
        }
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
        if (is_playing_buffer){
            source.stop();
        } else {
            start_audio(audio_buffer, 0);
        }
        return false;
    });


    $('#tts_form').submit(function () {
        if (is_playing_buffer){
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

    $('#add_oscillator').click(function () {
        $('#rem_oscillator').show();
        num_oscillators += 1;
        var id = 'osc' + num_oscillators;
        var osc_elem = "<div id='"+id+"'>"
                        +"<select id='"+id+"_type' class='osc_type'>"
                            +"<option value='sine'>Sine</option>"
                            +"<option value='square'>Square</option>"
                            +"<option value='triangle'>Triange</option>"
                            +"<option value='sawtooth'>Sawtooth</option>"
                        +"</select><br/>"
                        +"<label for='"+id+"_freq'>Frequency:</label>"
                        +"<input type='number' id='"+id+"_freq' value='440' min='0' max='50000' class='osc_freq' />"
                        +"<label for='"+id+"_amp'>Amplitude:</label>"
                        +"<input type='number' id='"+id+"_amp' value='0.5' min='0' max='1' step='0.1' class='osc_amp' />"
                       +"</div>"
        $('#oscillators').append(osc_elem);
        osc_node = context.createOscillator();
        osc_gain = context.createGain();
        osc_gain.gain.value = 0.5;
        osc_node.connect(osc_gain);
        osc_gain.connect(pre_gain);
        osc_node.start(0);
        is_playing = true;
        is_playing_osc = true;
        oscillators[id] = osc_node;
        osc_gains[id] = osc_gain;
    });

    $('#rem_oscillator').click(function () {
        $('#oscillators').children().last().remove();
        var id = 'osc' + num_oscillators;
        oscillators[id].stop(0);
        delete oscillators[id];
        delete osc_gains[id];

        num_oscillators -= 1;
        if (num_oscillators <= 0) {
            $('#rem_oscillator').hide();
            is_playing_osc = false;
            if (!is_playing_buffer && !is_playing_mic) {
                is_playing = false;
            }
        }
    });

    $('#oscillators').on('change', '.osc_type', function() {
        var id = $(this).parent().attr('id');
        oscillators[id].type = this.value;
    });

    $('#oscillators').on('change', '.osc_freq', function() {
        var id = $(this).parent().attr('id');
        oscillators[id].frequency.value = this.value;
    });

    $('#oscillators').on('change', '.osc_amp', function() {
        var id = $(this).parent().attr('id');
        osc_gains[id].gain.value = this.value;
    });

    $(document).on('keypress', function(e) {
        var tag = e.target.tagName.toLowerCase();
        if ( e.which === 32 && tag != 'input' && tag != 'textarea'){
            e.preventDefault();
            if(is_playing_buffer){
                source.stop(0);
            }else{
                start_audio(audio_buffer, 0);
            }
        }
    });

    $('.remove_button').click(function() {
       $(this).parent().remove(); 
       num_plots -= 1;
       percent = 100/num_plots;
       $('.plot_wrapper').css({ 'height': 'calc('+percent+'% - ' + 15+ 'px)' });
       ctx_oscilloscope.canvas.height = ctx_oscilloscope.canvas.offsetHeight;
       ctx_waveform.canvas.height = ctx_waveform.canvas.offsetHeight;
       ctx_spectrum.canvas.height = ctx_spectrum.canvas.offsetHeight;
       ctx_spectrogram.canvas.height = ctx_spectrogram.canvas.offsetHeight;
       tempCtx.canvas.height = ctx_spectrogram.canvas.offsetHeight;
       ctx_cepstrum.canvas.height = ctx_cepstrum.canvas.offsetHeight;
    });

    $('.effect').on('change', function(e) {
        effect = effects[e.target.id];
        if (e.target.checked) {
            source_node['node'].disconnect();
            source_node['node'].connect(effect['node']);
            effect['node'].connect(dest_node['node']);
            source_node['dest'] = effect;
            effect['source'] = source_node;
            effect['dest'] = dest_node;
            source_node = effect;
        }else{
            effect['node'].disconnect();
            effect['source']['node'].disconnect();
            effect['source']['node'].connect(effect['dest']['node']);
            effect['source']['dest'] = effect['dest'];
            effect['dest']['source'] = effect['source'];
            source_node = effect['source'];
            dest_node = effect['dest'];
        }
    });


    // Effect settings
    $('#filter_freq').on('change', function(e) {
        effects['filter']['node'].frequency.value = e.target.value;
    });
    $('#filter_Q').on('change', function(e) {
        effects['filter']['node'].Q.value = e.target.value;
    });
    $('#filter_type').on('change', function(e) {
        effects['filter']['node'].type = e.target.value;
    });
    $('#compressor_thresh').on('change', function(e) {
        effects['compressor']['node'].threshold.value = e.target.value;
    });
    $('#compressor_ratio').on('change', function(e) {
        effects['compressor']['node'].ratio.value = e.target.value;
    });
    $('#delay_time').on('change', function(e) {
        effects['delay']['node'].delayTime.value = e.target.value;
    });
    $('#impulse_response').on('change', function(e) {
        load_convolution_buffer(e.target.value);
    });
});

function handleFileSelect(e) {
    var files = e.target.files; // FileList object
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

function loopClick(e) {
    //var audio = document.getElementById('player');
    //audio.loop = checkboxElement.checked;
    if (source){
        source.loop = e.target.checked;
    }
}

function fftSizeChange(e) {
    var newValue = e.target.value;
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
    source.connect(pre_gain);
    source.buffer = audio_buffer;
    source.start(0,start_time);
    is_playing = true;
    is_playing_buffer = true;
    $('.button').val('\u00A0\u258C\u258C');
    if ($('#loop').is(":checked")){
            source.loop = true;
    }
    source.onended = function() {
        is_playing_buffer = false;
        if (!is_playing_osc && !is_playing_mic) {
            is_playing = false;
        }
        $('.button').val('\u25BA');
    }
}

function make_gradient(ctx){
    var grad = ctx.createLinearGradient(0,0,0,ctx.canvas.height);
    grad.addColorStop(1,'#000000');
    grad.addColorStop(0.85,'#ff0000');
    grad.addColorStop(0.35,'#ffff00');
    grad.addColorStop(0,'#ffffff');
    return grad;
}
