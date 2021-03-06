// Porter Stemmer

/***
  A word stemmer based on the Porter stemming algorithm.
  
      Porter, M. \"An algorithm for suffix stripping.\"
      Program 14.3 (1980): 130-137.

  A few minor modifications have been made to Porter's basic
  algorithm.  See the source code of this module for more
  information.

  The Porter Stemmer requires that all tokens have string types.

  This stemmer is based on the NLTL Python version with only slight changes.

***/

var _ = require('underscore')._;

var PorterStemmer = function() {
	
	var irregular_forms = {
      "sky" :     ["sky", "skies"],
      "die" :     ["dying"],
      "lie" :     ["lying"],
      "tie" :     ["tying"],
      "news" :    ["news"],
      "inning" :  ["innings", "inning"],
      "outing" :  ["outings", "outing"],
      "canning" : ["cannings", "canning"],
      "howe" :    ["howe"],

      // --NEW--
      "proceed" : ["proceed"],
      "exceed"  : ["exceed"],
      "succeed" : ["succeed"], // Hiranmay Ghosh
		}

		this.j = 0;
		this.b = "";
		this.k = 0;
		this.k0 = 0;
		
		this.pool = {}
		_this = this;
		_.each(irregular_forms,function(i,key) {
			_.each(irregular_forms[key],function(val) {
				_this.pool[val] = key;
			});
		});		
}

PorterStemmer.prototype.ends = function(s) {

	// ends(s) is TRUE <=> k0,...k ends with the string s.
	var length = s.length
	if (s[length - 1] != this.b[this.k]) return false;
	if (length > (this.k - this.k0 + 1)) return false;

	if (this.b.slice(this.k-length+1,this.k+1) != s) {
		return false;
	}
	
	this.j = this.k - length;
	return true;	
	
	// New Approch
	// if ((new RegExp(s + "$")).test(this.b)) {
	// 	this.j = this.k - s.length;
	// 	return true;		
	// } else {
	// 	return false;
	// } 
}

PorterStemmer.prototype.cons = function(i) {
	// cons(i) is TRUE <=> b[i] is a consonant.

	if (this.b[i] == 'a' || this.b[i] == 'e' || this.b[i] == 'i' || this.b[i] == 'o' || this.b[i] == 'u') {
		return false;
	}
		
	if (this.b[i] == 'y') {
		if (i == this.k0) {
			return true;
		} else {
			return (!this.cons(i - 1))
		}
	}
	
	return true;	
}

PorterStemmer.prototype.vowelinstem = function() {
	// vowelinstem() is TRUE <=> k0,...j contains a vowel
	for (var i = this.k0; i < this.j + 1;i++ ){
		if (!this.cons(i)) {
			return true;
		}
	}
	
	return false;

}

PorterStemmer.prototype.doublec = function(j) {
	// doublec(j) is TRUE <=> j,(j-1) contain a double consonant.
	if (j < (this.k0 + 1)) {
		return false;
	}
	if ((this.b[j] != this.b[j-1])) {
		return false;
	}
	return this.cons(j);
}

PorterStemmer.prototype.setto = function(s) {
	// setto(s) sets (j+1),...k to the characters in the string s, readjusting k.
	var length = s.length;
	// TODO This line seems questionable
	this.b = this.b.slice(0,this.j+1) + s + this.b.slice(this.j+length+1,length);
	this.k = this.j + length
}

PorterStemmer.prototype.cvc = function(i) {
	/*
    cvc(i) is TRUE <=>

    a) ( --NEW--) i == 1, and p[0] p[1] is vowel consonant, or

    b) p[i - 2], p[i - 1], p[i] has the form consonant -
       vowel - consonant and also if the second c is not w, x or y. this
       is used when trying to restore an e at the end of a short word.
       e.g.

           cav(e), lov(e), hop(e), crim(e), but
           snow, box, tray.        
	*/
	if (i == 0) return false; // i == 0 never happens perhaps
	if (i == 1) return (!this.cons(0) && this.cons(1));
	if (!this.cons(i) || this.cons(i-1) || !this.cons(i-2)) return false;
    
	ch = this.b[i]
	if (ch == 'w' || ch == 'x' || ch == 'y'){
		return false;
	}

	return true;
}

PorterStemmer.prototype.r = function(s) {

	if (this.m() > 0){
		this.setto(s);
	}
}

PorterStemmer.prototype.m = function(){
	/*
		m() measures the number of consonant sequences between k0 and j.
    if c is a consonant sequence and v a vowel sequence, and <..>
    indicates arbitrary presence,
    
       <c><v>       gives 0
       <c>vc<v>     gives 1
       <c>vcvc<v>   gives 2
       <c>vcvcvc<v> gives 3
       ....
	*/
	var n = 0;
	var i = this.k0;
	
	while (1) {
		if (i > this.j) {
			return n;
		}
		if (!this.cons(i)) {
			break;
		}
		i = i + 1;
	}
	i = i + 1

	while (1) {
		while (1) {
			if (i > this.j) {
				return n;
			}
			if (this.cons(i)) {
				break
			}
			i = i + 1;
		}
		i = i + 1;
		n = n + 1;
		while (1) {
			if (i > this.j) {
				return n;
			}
			if (!this.cons(i)) {
				break;
			}
			i = i + 1;
		}
		i = i + 1;
	}
}

PorterStemmer.prototype.step1ab = function() {
/***
	step1ab() gets rid of plurals and -ed or -ing. e.g.
    
		caresses  ->  caress
		ponies    ->  poni
		sties     ->  sti
		tie       ->  tie        (--NEW--: see below)
		caress    ->  caress
		cats      ->  cat
    
		feed      ->  feed
		agreed    ->  agree
		disabled  ->  disable
    
		matting   ->  mat
		mating    ->  mate
		meeting   ->  meet
		milling   ->  mill
		messing   ->  mess
    
		meetings  ->  meet
***/

	if (this.b[this.k] == 's') {
		if (this.ends("sses")) {
			this.k = this.k - 2
		} else if (this.ends("ies")) {
			if (this.j == 0) {
				this.k = this.k - 1;
			}
			// this line extends the original algorithm, so that
			// 'flies'->'fli' but 'dies'->'die' etc
			else {
				this.k = this.k - 2;
			}
		} else if (this.b[this.k - 1] != 's') {
			this.k = this.k - 1;
		}
	}

		
  if (this.ends("ied")) {
		if (this.j == 0) {
			this.k = this.k - 1;
		} else {
			this.k = this.k - 2;
		}
		// this line extends the original algorithm, so that
		// 'spied'->'spi' but 'died'->'die' etc

	} else if (this.ends("eed")) {
		if (this.m() > 0) {
			this.k = this.k - 1;
		}
	} else if ((this.ends("ed") || this.ends("ing")) && this.vowelinstem()) {
		this.k = this.j;
		if (this.ends("at")) {   
			this.setto("ate");
		} else if (this.ends("bl")) { 
			this.setto("ble");
		} else if (this.ends("iz")) { 
			this.setto("ize");
		} else if (this.doublec(this.k)) {
			this.k = this.k - 1;
			ch = this.b[this.k];
			if (ch == 'l' || ch == 's' || ch == 'z') {
				this.k = this.k + 1;
			}
		} else if ((this.m() == 1 && this.cvc(this.k))) {
			// TODO - Test this BLOCK
			this.setto("e");
		}	
	} 

}

PorterStemmer.prototype.step1c = function() {
	/*
  step1c() turns terminal y to i when there is another vowel in the stem.
  --NEW--: This has been modified from the original Porter algorithm so that y->i
  is only done when y is preceded by a consonant, but not if the stem
  is only a single consonant, i.e.

     (*c and not c) Y -> I

  So 'happy' -> 'happi', but
    'enjoy' -> 'enjoy'  etc

  This is a much better rule. Formerly 'enjoy'->'enjoi' and 'enjoyment'->
  'enjoy'. Step 1c is perhaps done too soon; but with this modification that
  no longer really matters.

  Also, the removal of the vowelinstem(z) condition means that 'spy', 'fly',
  'try' ... stem to 'spi', 'fli', 'tri' and conflate with 'spied', 'tried',
  'flies' ...
	*/
	if (this.ends("y") && this.j > 0 && this.cons(this.k - 1)) {
		this.b = this.b.slice(0,this.k) + 'i' + this.b.slice(this.k+1);
	}
}

PorterStemmer.prototype.step2 = function() {
/*
	step2() maps double suffices to single ones.
  so -ization ( = -ize plus -ation) maps to -ize etc. note that the
  string before the suffix must give m() > 0.
*/
  if (this.b[this.k - 1] == 'a') {
		if (this.ends("ational")){   
			this.r("ate")
		} else if (this.ends("tional")){  
			this.r("tion")
		}
  } else if (this.b[this.k - 1] == 'c'){
		if (this.ends("enci")){      
			this.r("ence");
		} else if (this.ends("anci")){
			this.r("ance");
		}
  } else if (this.b[this.k - 1] == 'e'){
		if (this.ends("izer")){
			this.r("ize");
		}
  } else if (this.b[this.k - 1] == 'l'){
    if (this.ends("bli")){       
			this.r("ble");
    } else if (this.ends("alli")){
			if (this.m() > 0){                     
				this.setto("al");
				this.step2();
			}
    } else if (this.ends("fulli")){
			this.r("ful");
    } else if (this.ends("entli")){   
			this.r("ent");
    } else if (this.ends("eli")){     
			this.r("e");
    } else if (this.ends("ousli")){   
			this.r("ous");
		}
  } else if (this.b[this.k - 1] == 'o'){
    if (this.ends("ization")){   
			this.r("ize");
    } else if (this.ends("ation")){   
			this.r("ate");
    } else if (this.ends("ator")){    
			this.r("ate");
		}
  } else if (this.b[this.k - 1] == 's'){
    if (this.ends("alism")){     
			this.r("al");
    } else if (this.ends("iveness")){ 
			this.r("ive");
    } else if (this.ends("fulness")){ 
			this.r("ful");
    } else if (this.ends("ousness")){ 
			this.r("ous");
		}
  } else if (this.b[this.k - 1] == 't'){
		if (this.ends("aliti")){     
			this.r("al");
		} else if (this.ends("iviti")){   
			this.r("ive");
		} else if (this.ends("biliti")){  
			this.r("ble");
		}
  } else if (this.b[this.k - 1] == 'g'){
		if (this.ends("logi")){
			this.j = this.j + 1;
			this.r("og");
		}
	}
}

PorterStemmer.prototype.step3 = function() {
  // step3() dels with -ic-, -full, -ness etc. similar strategy to step2.
  if (this.b[this.k] == 'e'){
		if (this.ends("icate")){
			this.r("ic")
		} else if (this.ends("ative")){   
			this.r("");
		} else if (this.ends("alize")){   
			this.r("al");
		}
  } else if (this.b[this.k] == 'i'){
		if (this.ends("iciti")){     
			this.r("ic");
		}
  } else if (this.b[this.k] == 'l'){
		if (this.ends("ical")){      
			this.r("ic");
		} else if (this.ends("ful")){     
			this.r("");
		}
  } else if (this.b[this.k] == 's'){
		if (this.ends("ness")){      
			this.r("");
		}
	}
}

PorterStemmer.prototype.step4 = function() {
  // step4() takes off -ant, -ence etc., in context <c>vcvc<v>.

	if (this.b[this.k - 1] == 'a'){
		if (this.ends("al")){ 
		} else { 
			return;
		}
  } else if (this.b[this.k - 1] == 'c'){
		if (this.ends("ance")){ 
		} else if ( this.ends("ence")){ 
		} else { 
			return;
		}
  } else if (this.b[this.k - 1] == 'e'){
		if (this.ends("er")){ 
		} else {
			return;
		}
  } else if (this.b[this.k - 1] == 'i'){
		if (this.ends("ic")){ 
		} else { 
			return;
		}
  } else if ( this.b[this.k - 1] == 'l'){
		if (this.ends("able")){ 
		} else if ( this.ends("ible")){ 
		} else{
			return;
		}
  } else if ( this.b[this.k - 1] == 'n'){
		if (this.ends("ant")){ 
		} else if ( this.ends("ement")){ 
		} else if ( this.ends("ment")){ 
    } else if ( this.ends("ent")){ 
		} else {
			return;
		}
  } else if (this.b[this.k - 1] == 'o'){
		if (this.ends("ion") && (this.b[this.j] == 's' || this.b[this.j] == 't')){ 
		} else if ( this.ends("ou")){ 
      // takes care of -ous
      } else{ 
				return;
			}
  } else if (this.b[this.k - 1] == 's'){
		if (this.ends("ism")){ 
		} else {
			return;
		}
  } else if (this.b[this.k - 1] == 't'){
		if (this.ends("ate")){
		} else if (this.ends("iti")){ 
		} else{
			return;
		}
  } else if ( this.b[this.k - 1] == 'u'){
		if (this.ends("ous")){ 
		} else {
			return;
		}
  } else if ( this.b[this.k - 1] == 'v'){
		if (this.ends("ive")){ 
		} else { 
			return;
		}
  } else if ( this.b[this.k - 1] == 'z'){
		if (this.ends("ize")){
		} else{
			return;
		}
  } else {
		return;
	}

  if (this.m() > 1){
		this.k = this.j;
	}
}

PorterStemmer.prototype.step5 = function() {
/*
	step5() removes a final -e if m() > 1, and changes -ll to -l if
 	m() > 1.
*/
  this.j = this.k;
  if (this.b[this.k] == 'e'){
		a = this.m();
		if (a > 1 || (a == 1 && !this.cvc(this.k-1))){
			this.k = this.k - 1;
		}
	}
  if (this.b[this.k] == 'l' && this.doublec(this.k) && this.m() > 1){
		this.k = this.k -1;
	}
}

/***
	 In stem(p,i,j), p is a char pointer, and the string to be stemmed
   is from p[i] to p[j] inclusive. Typically i is zero and j is the
   offset to the last character of a string, (p[j+1] == '\0'). The
   stemmer adjusts the characters p[i] ... p[j] and returns the new
   end-point of the string, k. Stemming never increases word length, so
   i <= k <= j. To turn the stemmer into a module, declare 'stem' as
   extern, and delete the remainder of this file.

***/
PorterStemmer.prototype.stemWord = function(p, i, j) {
	var j = j || null;
	
	if (j == null) j = p.length - 1;
	
	// copy the parameters into statics
  this.b = p;
  this.k = j;
  this.k0 = i;

  if (this.pool[this.b.slice(this.k0,this.k+1)]) {
		return this.pool[this.b.slice(this.k0,this.k+1)];	
	}
	
	if (this.k <= this.k0 + 1) {
		return this.b; // --DEPARTURE--		
	}

  // With this line, strings of length 1 or 2 don't go through the
  // stemming process, although no mention is made of this in the
  // published algorithm. Remove the line to match the published
  // algorithm.

	this.step1ab();
	this.step1c();
	this.step2();
	this.step3();
	this.step4();
	this.step5();
	return this.b.slice(this.k0,this.k+1);
	
}

// Returns the word back to its origional case
PorterStemmer.prototype.adjustCase = function(word, stem) {
	var ret = "",
	lower = word.toLowerCase(),
	i;
		
	ret = "";
	for (i = this.k0; i < this.j + 1;i++ ){
		if (lower[i] == stem[i]) {
			ret += word[i];
		} else {
			ret += stem[i];
		}
	}
	return ret;
}

PorterStemmer.prototype.stem = function(word) {
  	var stemmedResult = this.stemWord(word.toLowerCase(), 0, word.length - 1)
   	return this.adjustCase(word, stemmedResult)	
}

// Used to test each step.
PorterStemmer.prototype._testStem = function(word,step) {

	  this.b = word.toLowerCase();
	  this.k = word.length - 1;
	  this.k0 = 0;

	  if (this.pool[this.b.slice(this.k0,this.k+1)]) {
			return this.pool[this.b.slice(this.k0,this.k+1)];	
		}

		if (this.k <= this.k0 + 1) {
			return this.b;
		}

		if (step) {
			this[step]();
		}

		return this.b.slice(this.k0,this.k+1);
}

exports.PorterStemmer = PorterStemmer;