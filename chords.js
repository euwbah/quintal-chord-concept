// jshint esversion: 6

// script order: 3

// Use this on the first pass to seperate parts of the chord
// Capture group indexes:
// 1: Pitch Name
// 2: Accidental
// 3: Chord quality (Major, Minor, Dom, Sus)
//    (there are too many different ways to express these 4 qualities, hence
//    the use of (.*?) to match this)
//    Note that if the chord quality is a jumbled mess, it probably means that
//    the Extras section contains invalid chord modifiers.
// 4: Chord quality extension (2,4,7,9,11,#11,13,15,#15)
// 5: Alterations, additions, quasi-qualities like dim, hdim and aug
//
// Even though many people regard dim, hdim, and aug as chord qualities,
// further thought yields that both algorithmically and musically, these
// are not necessarily qualities of a chord, rather, they represent shorthand
// for alterations on top of the quality of the chord (which is dominant by default)
// e.g.:
// dim = b3 b5 bb7
// hdim = b3 b5 (note the lack of alterations to the 7th as it is is derived as per quality.
//               A major hdim would be totally possible and would represent b3 b5 major7)
// aug = #5
// alt = b5 #5 b7 b9 #9 b13
//
// Furthermore, all chord qualities accept extensions, which behave like 'parameters' to a function
// of which affects the output notes in a predictable and algorithmically computable manner
// (which is indeed the main point of the Quintal Chord Concept),
// whilst the above mentioned quasi-qualities do not have such behavior, and act much more like
// 'macros' that inline specific fixed alterations to chords.
//
// Test this here: https://regex101.com/r/IxcDTk/4
const CHORD_PARSER =
  /^([A-Ga-g])(b|#|)(.*?)(2|4|5|7|9|11|#11|13|15|#15)?((?:(?:(?:bb|b|#|x)?(?:5|6|7|9|11|13|15))|dim7*|[oO]7*|hdim|07*|aug|\+|add[b#]*1*[0-9]|no[b#]*1*[0-9]|alt)*)$/;

// Use this to parse the 'Extras' part of the chord after it has been parsed the first time.
// This RegExp will only return only the first match, one at a time.
//
// To use it, attempt matching, then substring the part that has been matched, repeat until
// there's no more string to match.
//
// If it doesn't match anything although there is still string left, that means that
// there is an error in the chord.
//
// Capture Group Indexes:
// 0 (Full match): Represents almost everything except the following:
//
// 1: If present, means that the modifier is an 'add' e.g. 'add13'.
//    The value of this group denotes the absolute interval to add to the chord
//    as per the Note.getInterval method.
//
// 2: If present, represents 'no' degree exclusion, e.g. 'no3'.
//    The value of this group denotes the degree of the base chord to omit.
//    Note that accidentals are not really necessary for the degree, but are
//    still supported as per the RegExp just in case.
//
// Test this here: https://regex101.com/r/FB5bDF/4
const CHORD_ALTERATIONS_PARSER =
  /^(?:(?:(?:bb|b|#|x)?(?:5|6|7|9|11|13|15))|dim7*|[oO]7*|hdim|07*|aug|\+|add([b#]*1*[0-9])|no([b#]*1*[0-9])|alt)/;

const Qualities = Object.freeze({
  MAJOR: 1,
  DOMINANT: 2,
  MINOR: 3,
  SUSPENDED: 4
});

class Chord {
  constructor(str) {
    let chordStr = str.replace(/\w+/, '');
    let [,root, rootAccidental, quality, extension, alterations] = chordStr.match(CHORD_PARSER);

    // Assign Root

    this.root = new Note(root + rootAccidental);

    // Parse Quality

    let lcQuality = quality.toLowerCase();
    if (['M', '\u0394'].includes(quality) ||
        ['t', 'ma', 'maj', 'major'].includes(lcQuality))
      this.quality = Qualities.MAJOR;

    else if (['m', '-'].includes(quality) ||
             ['mi', 'min', 'minor'].includes(lcQuality))
      this.quality = Qualities.MINOR;

    else if (!quality || quality.length === 0)
      this.quality = Qualities.DOMINANT;

    else if (['s', 'su', 'sus'].includes(lcQuality))
      this.quality = Qualities.SUSPENDED;

    // Assign Extension

    if (!extension || extension.length === 0)
      this.extension = 5;
    
  }
}
