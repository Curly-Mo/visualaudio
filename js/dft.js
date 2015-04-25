function dft(buffer){
	complex_buffer = complex_fft(buffer);
	magnitude_buffer = [buffer.length/2+1];
 	for(var k=0; k < complex_buffer.length/2+1; k++ ) {
 		var value = complex_buffer[k];
 		magnitude_buffer[k] = Math.sqrt(Math.pow(value[0], 2) + Math.pow(value[1], 2));
 	}
  //Slice to ignore bin zero (DC content) when scaling
 	//max = Math.max.apply(Math, magnitude_buffer.slice(1));
  max = Math.max.apply(Math, magnitude_buffer);
 	for(var k=0; k < magnitude_buffer.length; k++ ) {
 		var value = magnitude_buffer[k];
 		magnitude_buffer[k] = magnitude_buffer[k]*256/max;
 	}
	return magnitude_buffer;
}

function complex_fft( buffer ) {
 var len = buffer.length;
 var output = new Array();
 
 for( var k=0; k < len; k++ ) {
   var real = 0;
   var imag = 0;
   for( var n=0; n < len; n++ ) {
     real += buffer[n]*Math.cos(-2*Math.PI*k*n/len);
     imag += buffer[n]*Math.sin(-2*Math.PI*k*n/len);
   }
   output.push( [ real, imag ] )
 }
 return output;
}