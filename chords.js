// jshint esversion: 6

// script order: 3

// Use this on the first pass to seperate parts of the chord
// Capture group indexes:
// 1: Pitch Name
// 2: Accidental
// 3: Chord quality (Major, Minor, Dom)
//    Note that if the chord quality is a jumbled mess, it could also mean that
//    the Alterations section contains invalid chord modifiers.
// 4: Extension level
// 5: Alterations, additions, quasi-qualities
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
// However, should an extension be annotated without a prior defined quality-extension pair,
// it is conventional to see one put the extension after these quasi-qualities,
// hence the use of the term 'quasi'.
// For the sake of brevity they shall be referred to as "quasi-extensions".
//
// e.g. Caug13 => C13aug => C dominant-13 #5 => C E G# Bb D F A
//      Cdim9sus4 => C9dimsus4 => C dominant-9 no-3 add-4 (no-b3) b5 b-of-b7 => C F Gb Bbb D
//
// But for cases like the following, the degrees after quasi-qualities are NOT
// quasi-extensions because the quality-extension pair has been already defined.
//
//                   quality-extension pair
//                          vvvvvvv
//      Cmaj9hdim11b13 => C major-9 b3 b5 add-11 add/alt-b13 => C Eb Gb B F Ab
//
// Note in the following how either qualities or extensions of the
// quality-extension pair can be implied...
//
//      Cmajaug9 => C major-5(implied) #5 add-9(not quasi-extension!) => C E G# D
//      C9hdim#11 => C dominant(implied)-9 b3 b5 add-#11(not QE!) => C Eb Gb Bb D F#
//
// Hence, if the base quality isn't dominant, the alterations parser will need
// to parse these and update the base extension accordingly. If a base quality is
// already specified (e.g. major, minor, suspended),
// the numbers can be treated as additions/alterations instead of extensions.
//
// Test this here: https://regex101.com/r/IxcDTk/5
const CHORD_PARSER =
  /^([A-Ga-g])(b|#|)(.*?)(2|3|4|5|7|9|11|#11|13|15|#15)?((?:(?:(?:bb|b|#|x)?1*[0-9])|dim|o|O|\u{006F}|\u{00B0}|hdim|0|\u{00F8}|\u{1D1A9}|sus|aug|\+|add[b#]*1*[0-9]|no[b#]*1*[0-9]|alt)*)$/u;

// Use this to parse the alterations of a chord.
// This RegExp will only return only the first match, one at a time.
//
// To use it, attempt matching, then substring the part that has been matched, repeat until
// there's no more string to match.
//
// If it doesn't match anything although there is still string left, that means that
// there is an error in the chord.
//
// Capture Group Indexes:
// 0: If only group[0] exists, denotes that alteration is an addition-alteration,
//    sometimes people put these in brackets to aid in readability, e.g. Cmaj7(#9)(13),
//    but it isn't actually necessary grammar, logically speaking.
//
//    Add-alts behave as either additions or alterations depending on the situation:
//
//    If the add-alt degree exists in the unaltered form, alter that degree
//        Cmin13(#11) -> 11 exists in the tertian stack of 13, hence it is replaced with #11
//                    => C Eb G Bb F# A
//
//    If the add-alt degree does NOT exist in the unaltered form, treat it as an `add`
//        Cmin13(#4) -> 4 doesn't exist in the tertian stack of 13
//                   -> C minor-13 add-#4 => C Eb F# G Bb D F A
//
//    If there is already an existing add-alt of the same degree, treat it as an `add`
//        C+11(b9)(#9) -> the 9 is both # and b;
//                           the first ninth (b9) replaces the original 9
//                           the second ninth becomes an add-#9
//                     -> C dominant-11 aug-#5 alt-b9 add-#9
//                     -> C E G# Bb Db D# F
//
//
// 1: If present, denotes a quasi-quality. In these cases, remember to
//    set a flag for an upcoming quasi-extension should there be no prior existing
//    quality-extension pairs.
//
// 2: If present, denotes the degree to 'add' e.g. 'add13'.
//    The value of this group denotes the absolute interval to add to the chord
//    as per the Note.getInterval method.
//
// 3: If present, denotes the degree to exclude from the base chord, e.g. 'no3'.
//    The value of this group denotes the degree of the base chord to omit.
//    Note that accidentals are not really necessary for the degree, but are
//    still supported as per the RegExp just in case.
//
// 4: If present, denotes that this is a `sus` quasi-quality.
//
// 5: If present, denotes the degree after `sus`, if any.
//    This one is very complicated and its value and presence could mean one of the following:
//
//    a. If 2 or 4, it simply represents which degree the third gets suspended to
//
//    b. Otherwise, if the quasi-extension rule applies, represents the
//       the quasi-extension of a dominant, whilst still suspending the third
//       to a fourth. (A sus always suspends to a 4th by default)
//       The value would be one of the tertian degrees 7,9,11 or 13, although
//       11 is a bit redundant since it is exactly the same as a sus9.
//       e.g. Csus9 => C9sus => C9sus4.
//
//    c. Otherwise, treat it as a standard add-alt.
//
//    d. If there isn't any numerical value, i.e. just 'sus', and the
//       quasi-extension rule applies, the default extension is "9".
//       Csus+ => Csus9aug => C dominant-9 sus-4 alt-#5 => C F G# Bb D
//
//    e. If there isn't any value and the quasi-extension rule doesn't apply,
//       it defaults to a sus4.
//       Ct9sus => C major-9 sus-4 => C F G B D
//
// Test this here: https://regex101.com/r/FB5bDF/5
const CHORD_ALTERATIONS_PARSER =
  /^(?:(?:(?:bb|b|#|x)?1*[0-9])|(dim|o|O|\u{006F}|\u{00B0}|hdim|0|\u{00F8}|\u{1D1A9}|aug|\+)|add([b#]*1*[0-9])|no([b#]*1*[0-9])|sus(2|4|7|9|11|13)|alt)/u;

const Qualities = Object.freeze({
  MAJOR: 1,
  DOMINANT: 2,
  MINOR: 3,
});

class Degree {
  constructor(str) {
    this.__strValue = str;
    let match = str.match(/(bb|b|#|x|)(\d+)/);
    if (match === null)
      throw str + " is not a valid degree";

    [,this.accidental, this.degree] = match;
  }

  get accidental() {
    return this.__accidental;
  }
  set accidental(value) {
    this.__accidental = value;
    this.__accidentalClass = toAccidentalClass(value);
  }

  get accidentalClass() {
    return this.__accidentalClass;
  }
  set accidentalClass(value) {
    this.__accidentalClass = value;
    this.__accidental = toAccidental(value);
  }

  toString() {
    return this.__strValue;
  }
}

class Chord {
  constructor(str) {

    this.root = undefined;        // Note object
    this.quality = undefined;     // Qualities enum
    this.extension = undefined;   // Number
    this.alterations = undefined; // [Degree] indexed by scalic degree
    this.addedNotes = undefined;  // [Degree] list
    this.removedNotes = undefined;// [Degree] list

    // Order of operations:
    // Root -> Quality-extension -> Removed notes applied to unaltered chords
    //      -> Alterations applied to remaining basic chord tones
    //      -> Additional notes that aren't affected by any of the previous steps.

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

    let no3 = false;
    let impliedSuspension;

    // Handling some shorthands...
    if (this.quality === Qualities.DOMINANT) {
      // if the 5 extension is explicitly stated, it would mean that it is
      // a power chord, so the powerChord flag needs to be set so that
      // a `no3` can be set later
      if (extension == 5)
        no3 = true;

      // C2 and C4, although syntactically incorrect, is shorthand for Csus2 and Csus4
      if (extension == 2 || extension == 4) {
        impliedSuspension = extension;
        extension = 5;
      }
    }

    // This flag is used later to make sure quasi extensions are correctly identified
    let noQualityExtensionPair = false;

    // Implied extension is 5.
    if (!extension || extension.length === 0) {
      this.extension = 5;
      if (this.quality === Qualities.DOMINANT)
        // No extension nor quality provided
        noQualityExtensionPair = true;
    } else
      this.extension = Number.parseInt(extension);

    // Handle Alterations

    // The CHORD_ALTERATIONS_PARSER matches one alteration at a time
    // The match should never be null, because that means there's an
    // error, and all errors should be handled when parsing chord quality.

    let remaining = alterations;


    let quasiExtensionFlag = false;

    // only the first alteration can be granted the quasiExtensionFlag
    let first = true;

    this.alterations = [];
    // empty string will be coerced into a falsey value.
    while(remaining) {
      let match = remaining.match(CHORD_ALTERATIONS_PARSER);
      if (match === null)
        throw 'Internal error! Alteration error fell through quality parsing check :(';

      let [full, quasiQuality, addDegree, noDegree, susMatch, susDegree] = match;

      if (quasiQuality) {
        if (first)
          quasiExtensionFlag = true;

        if (['dim','o','\u006F','\u00B0'].includes(quasiQuality)) {
          this.alterations[3] = new Degree('b3');
          this.alterations[5] = new Degree('b5');
          this.alterations[7] = new Degree('bb7');
        } else if (['hdim', '0', '\u00F8', '\u{1D1A9}'].includes(quasiQuality)) {
          this.alterations[3] = new Degree('b3');
          this.alterations[5] = new Degree('b5');
        } else if (['aug', '+'].includes(quasiQuality)) {
          this.alterations[5] = new Degree('#5');
        }
      } else if (addDegree) {

      } else if (noDegree) {

      } else if (quasiExtensionFlag) {
        quasiExtensionFlag = false;
      } else if (susMatch) {

      } else {

      }

      first = false;
    }
  }
}
