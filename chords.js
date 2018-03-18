// jshint esversion: 6

// script order: 3

// Use this on the first pass to seperate parts of the chord
// Capture group indexes:
// 1: Pitch Name
// 2: Accidental
// 3: Chord qualities (Major, Minor, Dom, Sus)
//    Note that if the chord qualities are a jumbled mess, it could also mean that
//    the Alterations section contains invalid chord modifiers.
// 4: Alterations, additions, quasi-qualities
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
// However, it should there be a proper extension to the chord, it would still be conventional
// to put the extension after these quasi-qualities:
// e.g. Caug13 => C13aug => C dominant-13 #5
//      Cdim9sus4 => C9sus4dim => C dominant-9 no-3 add-4 b3 b5 bb7
//
// Note that 'sus' behaves both like an alteration as well as a quality.
// e.g. in Cmaj7sus2/Cmaj7sus4, the quality is major-7 and the sus2/sus4 have the same effect
// as the no3add2/no3add4 alterations.
//
// However, the sus in chords like Csus7, Csus9 (the default form of Csus), Csus13,
// although effectively representing C7sus4, C9sus4, and C13sus4 respectively,
// they behave like chord qualities because they mirror the algorithmic generation
// of the dominant extension series, whilst keeping.
//
// However, it is pointlesss to differentiate the two different gramatical usages of
// sus in terms of regex parsing. In the former example where sus behaves like an alteration,
// the 'Quality' capture group will capture both the major-7 and the sus2/4 as if both were
// qualities.
//
//
// Test this here: https://regex101.com/r/IxcDTk/5
const CHORD_PARSER =
  /^([A-Ga-g])(b|#|)((?:.*?(?:2|3|4|5|7|9|11|#11|13|15|#15)?)*?(?:2|3|4|5|7|9|11|#11|13|15|#15)?)((?:(?:(?:bb|b|#|x)?1*[0-9])|(?:dim|o|O|\u{006F}|\u{00B0}|hdim|0|\u{00F8}|\u{1D1A9})7*|aug|\+|add[b#]*1*[0-9]|no[b#]*1*[0-9]|alt)*)$/u;

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
  /^(?:(?:(?:bb|b|#|x)?(?:2|3|4|5|6|7|9|11|13|15))|dim7*|[oO]7*|hdim|07*|aug|\+|add([b#]*1*[0-9])|no([b#]*1*[0-9])|alt)/;

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

    else {
      // There chord is erroneous... time to find out what went wrong...
      let remaining = chordStr.substring((root + rootAccidental).length);

      // Parse for alterations popping one character at a time,
      // If any legitimate alterations exist at all, the immediate following
      // unparsable section, if any, would be the point at which there is one
      // or more invalid alterations.

      // However, if the entire process does not yield any successfully
      // parsing alterations, that means that the chord quality itself
      // has an error. (e.g. no such quality exists).

      // Unfortunately, if the entire `remaining` string sucessfully parses,
      // then there is something seriously wrong with the parsing and
      // error detection logic... lets hope not.

      let legitimateAlterationsExist = false;
      while(remaining.length !== 0) {
        let match = remaining.match(CHORD_ALTERATIONS_PARSER);
        if (match !== null) {
          // A legitimate alteration exists
          legitimateAlterationsExist = true;

          // Pop off the fully matched legitimately parsed alteration
          remaining = remaining.substring(match[0].length);
        } else if (legitimateAlterationsExist) {
          // If a legitimate alteration has been matched, and this one isn't
          // legitimate, that means this is the part that is causing the error.
          throw 'Invalid chord alteration at ' + remaining;
        } else {
          // Otherwise, if nothing has been detected yet, and the
          // alterations aren't parsing, pop the first character off the remaining
          // and try again until everything is popped.

          remaining = remaining.substring(1);
        }
      }

      if (legitimateAlterationsExist) {
        // If everything has been popped and there were legitimate alterations,
        // this parsing logic has failed... :(

        throw 'Internal Error! Chord error detection logic broke down :(';
      }

      // Otherwise, that means the chord quality itself is erroneous.

      throw remaining + ' is not a valid chord quality/alteration';
    }

    // Assign Extension

    let powerChord = false;

    if (!extension || extension.length === 0)
      this.extension = 5;
    else
      this.extension = Number.parseInt(extension);

    if (this.quality === Qualities.DOMINANT) {
      // if the 5 extension is explicitly stated, it would mean that it is
      // a power chord, so the powerChord flag needs to be set so that
      // a `no3` can be set later
      if (extension == 5)
        powerChord = true;

      if (extension == 2 || extension == 4)
        this.quality = Qualities.SUSPENDED;
    }

    // Handle Alterations

    // The CHORD_ALTERATIONS_PARSER matches one alteration at a time
    // The match should never be null, because that means there's an
    // error, and all errors should be handled when parsing chord quality.

    let remaining = alterations;

    // empty string will be coerced into a falsey value.
    while(remaining) {
      let match = remaining.match(CHORD_ALTERATIONS_PARSER);
      if (match === null)
        throw 'Internal error! Alteration error fell through quality parsing check :(';

      let [fullMatch, addDegree, noDegree] = match;

      if (addDegree) {

      }
    }
  }
}
