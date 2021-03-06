// jshint esversion: 6

// script order: 3

const DEBUG_CHORD = true;

function debug(str) {
  if (DEBUG_CHORD) {
    console.log(str);
  }
}

// Representing the various triangle symbols out there
// U+2206 happens to be on the Gboard on androids and U+0394 is in the greek alphabet
const MAJ_CHARS = ['M', '\u{25B3}', '\u{2206}', '\u{0394}', '\u{25B5}', '\u{141E}'];

// Representing various the circular symbols
// U+00B0 is the 'degree' sign on the Gboard
const DIM_CHARS = ['o', 'O', '\u{1D698}', '\u{25CB}', '\u{1D3C}', '\u{25E6}', '\u{00B0}']

const HALF_DIM_CHARS = ['0', '\u{00D8}', '\u{00F8}', '\u{2205}', '\u{2300}', '\u{1D1A9}']

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
// Test this here: https://regex101.com/r/IxcDTk/13
const CHORD_PARSER =
  /^([A-Ga-g])(bb|b|#|x|)(.*?)(2|3|4|5|7|9|11|#11|13|15|#15)?((?:(?:(?:bb|b|#|x)?(?:10|1?[1-9]))|[Dd][Ii][Mm]|o|O|\u{1D698}|\u{25CB}|\u{1D3C}|\u{25E6}|\u{00B0}|[Hh][Dd][Ii][Mm]|0|\u{00D8}|\u{00F8}|\u{2205}|\u{2300}|\u{1D1A9}|[Ss][Uu][Ss]|[Aa][Uu][Gg]|\+|[Aa][Dd][Dd][b#]*1*[0-9]|[Nn][Oo][b#]*1*[0-9]|[Aa][Ll][Tt]|[()])*)$/u;

// Same as ALTERATION_UNWANTED_CHARS except brackets are kept for parsing
// brackets are used to identify C#11 [C# dom-11] from C(#11) [C add-#11]
// The brackets will be removed in ALTERATION_UNWANTED_CHARS
const CHORD_UNWANTED_CHARS = /(?:(?![-+\u{394}\u{006F}\u{00B0}\u{00F8}\u{1D1A9}#()])[\s\{\}\W_])+/gu;

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
//    c. Otherwise, treat it as a standard add-alt, and default the sus to a sus4
//
//    d. If there isn't any numerical value, i.e. just 'sus', and the
//       quasi-extension rule applies, the default extension is "9".
//       Csus+ => Csus9aug => C dominant-9 sus-4 alt-#5 => C F G# Bb D
//
//    e. If there isn't any value and the quasi-extension rule doesn't apply,
//       it defaults to a sus4.
//       Cmaj9sus => C major-9 sus-4 => C F G B D
//
// Test this here: https://regex101.com/r/FB5bDF/13
const CHORD_ALTERATIONS_PARSER =
  /^(?:(?:(?:bb|b|#|x)?(?:10|1?[1-9]))|([Dd][Ii][Mm]|o|O|\u{1D698}|\u{25CB}|\u{1D3C}|\u{25E6}|\u{00B0}|[Hh][Dd][Ii][Mm]|0|\u{00D8}|\u{00F8}|\u{2205}|\u{2300}|\u{1D1A9}|[Aa][Uu][Gg]|\+)|[Aa][Dd][Dd]([b#]*1*[0-9])|[Nn][Oo]([b#]*1*[0-9])|([Ss][Uu][Ss](2|4|7|9|11|13)?)|alt)/u;

// Like CHORD_UNWANTED_CHARS, but removes brackets as well
const ALTERATION_UNWANTED_CHARS = /(?:(?![-+\u{394}\u{006F}\u{00B0}\u{00F8}\u{1D1A9}#])[\s\{\}\W_])+/gu;

const Qualities = Object.freeze({
  MAJOR: 1,
  DOMINANT: 2,
  MINOR: 3,
});

const DimMode = Object.freeze({
  NONE: 0,
  HALF: 1,
  FULL: 2
});

const SusMode = Object.freeze({
  NONE: 0,
  TWO: 2,
  FOUR: 4
});

// Used inside Degree object to denote where did the
// precence or absence of the degree come from
const DegreeSource = Object.freeze({
  UNSPECIFIED: 0,     // For behind-the-scenes usage, the rest are for display purposes
  QUALITY: 1,         // Unaltered chord tone
  NO: 2,              // Removed chord tone
  ALTERATION: 3,      // Altered chord tone from explicit add-alt
  ALT_DIM: 4,         // Pure-alt from diminished quasi-quality
  ALT_HDIM: 5,        // Pure-alt from half-dim quasi-quality
  ALT_AUG: 6,         // Pure-alt from augmented quasi-quality
  ADDITION: 7,        // Added degree (regardless of chord tone)
  SUSPENSION: 8,      // Represents either the 2nd or 4th degree - the suspended 3rd
  SUSPENDED_THIRD: 9  // Represents the 3rd degree that has been suspended
});

// For both internal transient usage and display purposes
// Degree source need not be specified for internal usage.
class Degree {
  // str: the numeral degree
  // degreeSource?: how is the degree derived (when constructing the chord)
  // included?: Represents whether this degree is a note that belongs in the chord,
  //            or if it is implicitly or explicitly excluded from the chord
  constructor(str, degreeSource=DegreeSource.UNSPECIFIED, included=null) {
    this.__strValue = str;
    let match = str.match(/(bb|b|#|x|)(\d+)/);
    if (match === null)
      throw str + " is not a valid degree";

    let [,accidentalStr, degreeStr] = match;

    this.accidental = accidentalStr;
    this.degree = Number.parseInt(degreeStr);
    this.optional = false;
    // Note that setting the .source property will also
    // automatically set the .included property
    this.source = degreeSource;
    // But the included parameter, if specified, will override that
    // inducted by .source
    if (included !== null)
      this.included = included;
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

  get source() {
    return this.__source;
  }
  set source(value) {
    this.__source = value;

    // set the chord inclusion status based on the source
    // explicitly denoting NO or SUSPENDED_THIRD on the degree
    // is also the act of explicitly denoting the lack of that
    // degree in a chord.

    // However, implicit exclusion will require manual assignment
    // to the this.included field, e.g. when a `bb7` exists
    // from a full dim alteration, but the chord extension is only
    // specified as a 'dim' (effectively 'dom5dim') not a 'dim7',
    // although the bb7 alteration exists, it is not being utilised
    // because the 7th is not in the chord tone.
    this.included = ![DegreeSource.NO, DegreeSource.SUSPENDED_THIRD].includes(value);
  }

  toString() {
    return this.__strValue;
  }
}

class Chord {
  constructor(str) {

    this.root = undefined;              // Note object
    this.quality = undefined;           // Qualities enum
    this.extension = undefined;         // Number
    this.explicitLydianTertian = false; // True if #11 or #15 was the explicit extension
                                        // of a major chord
    this.suspension = SusMode.NONE;     // SusMode enum
    this.dimMode = DimMode.NONE;        // DimMode enum
    this.aug = false;                   // true if has aug, false otherwise
    this.alterations = [];              // [[Degree]] list of degrees indexed by scalic degree
    this.addedNotes = [];               // [Degree] list
    this.removedNotes = [];             // [Degree] list

    // true when the chord has no explicitly stated quality and degree
    this.defaultQualityExtension = undefined;

    // Order of operations:
    // Root -> Quality-extension -> Removed notes applied to unaltered chords
    //      -> Alterations applied to remaining basic chord tones
    //      -> Additional notes that aren't affected by any of the previous steps.

    // Remove all unnecessary/unwanted characters & whitespaces except parenthesis
    // the parens are useful for identifying C#11 from C(#11)
    let chordStr = str.replace(CHORD_UNWANTED_CHARS, '');
    let __maybeChord = chordStr.match(CHORD_PARSER);
    if (__maybeChord === humannull)
      throw `${str} is not a chord`;

    let [,root, rootAccidental, quality, extension, alterations] = chordStr.match(CHORD_PARSER);

    // Remove parens once alterations has been (more) accurately seperated from
    // the extension
    alterations = alterations.replace(ALTERATION_UNWANTED_CHARS, '');

    // Assign Root

    this.root = new Note(root + rootAccidental);

    // Parse Quality

    let lcQuality = quality.toLowerCase();
    if (MAJ_CHARS.includes(quality) ||
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

    // #11, 15, and #15 should only be extensions if the quality was
    // explicitly denoted as major, and treated as add-alts otherwise,
    // but the RegExp will parse #11/15/#15 numerals after
    // the quality as extensions, so this should fix it.

    if (this.quality !== Qualities.MAJOR) {
      if (['#11', '15', '#15'].includes(extension)) {
        // prepend alterations with the impostor extensions
        alterations = extension + alterations;
        // revert extension to nothing
        extension = '';
      }
    }

    // Handling some shorthands...
    if (this.quality === Qualities.DOMINANT) {
      // Power Chord = no3
      if (extension == 5)
        this.removedNotes.push(new Degree('3'));

      // C2 and C4, although syntactically incorrect, is shorthand for Csus2 and Csus4
      if (extension == 2 || extension == 4) {
        this.suspension = extension == 2 ? SusMode.TWO : SusMode.FOUR;
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
    } else {
      // Set explicit extension
      let numeralExtension = extension;

      if (extension.includes('#')) {
        // The explicit lydianity of the extension can be
        // ignored, although not consistent with conventional
        // chord theory, it is the fundamental precept of
        // the quintal-lydian chord concept
        numeralExtension = extension.substring(1);
        this.explicitLydianTertian = true;
      }

      this.extension = Number.parseInt(numeralExtension);
    }

    // This field is more for info purposes than a flag
    this.defaultQualityExtension = noQualityExtensionPair;

    // Handle Alterations

    // This one comes up in a few different places, might as well
    // abstract out the function
    let handleAddAlt = (str) => {
      let degree = new Degree(str);

      // if degree numeral is part of the tertian series as denoted by the
      // chord's extension...
      if (degree.degree <= this.extension && degree.degree % 2 === 1 &&

        // ... and an alteration of this degree already doesn't exist,..
          !this.alterations[degree.degree] &&
        // ... and the chord tone wasn't already explicitly removed,
        //     (can't alter a chord tone that doesn't exist...)
          this.removedNotes.filter(x => x.degree === degree.degree).length === 0 &&
        // ... and if the add-alt doesn't conflict with a suspended third...
          !(this.suspension !== SusMode.NONE && degree.degree === 3)) {

        debug('Handled add-alt as alt: ' + str);
        // ...then treat it as an alteration
        this.alterations[degree.degree] = [degree];

      } else {
        debug('Handled add-alt as add: ' + str);
        // otherwise, treat it as an addition
        // note that in `Cno3b3` and `Cmaj7sus3`
        // the add-alt `3` will be considered an addition,
        // redundancy / logical conflicts won't be regarded as errors
        this.addedNotes.push(degree);
      }
    }

    // Even though `pure-alts` as used by quasi-qualities only alter notes,
    // and not add them if not already part of the tertiary series,
    //    ( e.g. bb7 in `dim` will not force upon an add-bb7 if there is )
    //    (      no 7th originally, but will only alter the 7th there    )
    //    (      happened to be one in the base chord.                   )
    // two conflicting pure-alts (such as the b5 and #5 in Chdimaug)
    // will result in a multi-alt, in which both, or even three, alterations
    // will simultaneously sound if and only if the degree of the alteration
    // is encapsulated within the tertian series of the extension.
    let handleAlt = (...alts) => {
      debug('handle pure-alts: ' + alts);
      for (let alt of alts) {
        let degree = new Degree(alt);

        if (!this.alterations[degree.degree]) {
          debug('Handled pure-alt: ' + alt);
          // No conflicting alterations - create the alteration
          this.alterations[degree.degree] = [degree];
        } else {
          debug('Handled multi-alt: ' + alt);
          // Alteration with same degree already exists - add more alterations
          this.alterations[degree.degree].push(degree);
        }
      }
    }

    // The CHORD_ALTERATIONS_PARSER matches one alteration at a time
    // The match should never be null, because that means there's an
    // error, and all errors should be handled when parsing chord quality.

    let remaining = alterations;


    let quasiExtensionFlag = false;

    // only the first alteration can be granted the quasiExtensionFlag
    let first = true;

    // empty string will be coerced into a falsey value.
    while(remaining) {
      let match = remaining.match(CHORD_ALTERATIONS_PARSER);
      if (match === null)
        throw 'Internal error! Alteration error fell through quality parsing check :(';

      let [full, quasiQuality, addDegree, noDegree, susMatch, susDegree] =
        match.map(x =>
          x !== undefined ? x.toLowerCase() : undefined);

      // pop out matched chars from the remaining string
      remaining = remaining.substring(full.length);

      let quasiExtensionRuleApplies = first && noQualityExtensionPair;

      if (quasiQuality) {
        if (quasiExtensionFlag)
          quasiExtensionFlag = true;

        if (quasiQuality === 'dim' || DIM_CHARS.includes(quasiQuality)) {
          if (this.dimMode === DimMode.NONE) {
            debug('dim');
            this.dimMode = DimMode.FULL;
            handleAlt('b3', 'b5', 'bb7');
          } else {
            throw 'Chord can\'t have both types of diminished!';
          }
        } else if (quasiQuality === 'hdim' || HALF_DIM_CHARS.includes(quasiQuality)) {
          if (this.dimMode === DimMode.NONE) {
            debug('half-dim');
            this.dimMode = DimMode.HALF;
            handleAlt('b3', 'b5');

            // A half-dim defaults as a 7th chord if quality-extension is not already explicitly stated
            if (noQualityExtensionPair)
              this.extension = 7;
          } else {
            throw 'Chord can\'t have both types of diminished';
          }
        } else if (['aug', '+'].includes(quasiQuality)) {
          if (!this.aug) {
            debug('aug');
            this.aug = true;
            handleAlt('#5');
          } else {
            throw 'Chord can\'t be augmented more than once';
          }
        } else {
          throw 'Internal error! Unexpected match for quasi quality: ' + quasiQuality;
        }
      } else if (addDegree) {
        debug('add degree: ' + addDegree);
        this.addedNotes.push(new Degree(addDegree));
      } else if (noDegree) {
        debug('no degree: ' + noDegree);
        this.removedNotes.push(new Degree(noDegree));
      } else if (quasiExtensionFlag) {
        // Clear the flag
        quasiExtensionFlag = false;

        // NOTE: things like Number.parseInt('b3') will return NaN
        // and [...].includes(NaN) will return false so it's alright.
        if ([3, 5, 7, 9, 11, 13].includes(Number.parseInt(full))) {
          debug('quasi-extension: ' + full);
          // A quasi extension must be an element of the set of extensions a
          // dominant chord can have...

          // Only in this scenario, update the extension
          this.extension = Number.parseInt(full);

          // Once a quasiExtension has been established,
          // the chord is no longer without a quality-extension pair,
          // since the extension has been explicitly stated via
          // quasi-extension
          noQualityExtensionPair = false;
        } else {
          // Otherwise, treat it like a standard add-alt
          handleAddAlt(full);
        }
      } else if (susMatch) {
        // SUS IS A HUGE PROBLEM

        //    a. If 2 or 4, it simply represents which degree the third gets suspended to
        //
        //    b. Otherwise, if the quasi-extension rule applies, represents the
        //       the quasi-extension of a dominant, whilst still suspending the third
        //       to a fourth. (A sus always suspends to a 4th by default)
        //       The value would be one of the tertian degrees 7,9,11 or 13, although
        //       11 is a bit redundant since it is exactly the same as a sus9.
        //       e.g. Csus9 = C9sus = C9sus4 => C dom-9 sus-4
        //
        //    c. Otherwise, treat it as a standard add-alt, and default the sus
        //       to a sus4
        //
        //    d. If there isn't any numerical value, i.e. just 'sus', and the
        //       quasi-extension rule applies, the default extension is "9".
        //       Csus+ = Csus9aug => C dominant-9 sus-4 alt-#5 => C F G# Bb D
        //
        //    e. If there isn't any value and the quasi-extension rule doesn't apply,
        //       it defaults to a sus4.
        //       Cmaj9sus => C major-9 sus-4 => C F G B D

        if (susDegree) {
          // case A: explicit suspension degree
          if (susDegree == 2 || susDegree == 4) {
            debug('sus' + susDegree + ' literal');
            this.suspension = susDegree == 2 ? SusMode.TWO : SusMode.FOUR;
          }

          // case B: quasi extension for dominant quality, implicit sus4
          else if (quasiExtensionRuleApplies &&
                   [3,5,7,9,11,13].includes(Number.parseInt(susDegree))) {
            debug('sus4 implied, quasi-extension: ' + susDegree);
            this.suspension = SusMode.FOUR;
            this.extension = Number.parseInt(susDegree);
          }

          // case C: fall back to standard add-alt, implicit sus4
          else {
            debug('sus4 implied, standard add-alt: ' + susDegree);
            this.suspension = SusMode.FOUR;
            handleAddAlt(susDegree);
          }
        } else {
          // case D: No explicit degree, but quasi-extension applies
          //         implicit sus4 and dominant-9 quasi extension
          if (quasiExtensionRuleApplies) {
            debug('sus4 implied, implied dominant-9th quasi-extension');
            this.suspension = SusMode.FOUR;
            this.extension = 9;
          }

          // case E: No explicit degree, no implicit quasi-extension,
          //         just sus4, raw sus4.
          else {
            debug('sus4 implied, no add-alts');
            this.suspension = SusMode.FOUR;
          }
        }
      } else {
        debug('handle standard add-alt: ' + full);
        // Standard add-alt
        handleAddAlt(full);
      }

      first = false;
    }
  }

  // (3, Qualities.MINOR) -> Degree('b3')
  // (11, Qualities.MAJOR) -> Degree('#11')
  // etc...
  // Note that only the tertiary extension series are accepted for
  // the degree parameter
  static applyGenderToExtension(degree, quality) {
    let d = Number.parseInt(degree);

    // Root colours are gender-neutral
    if ([1,5,9,13].includes(d)) {
      return new Degree(d.toString());
    }

    if (d === 3 && [Qualities.DOMINANT, Qualities.MAJOR].includes(quality)) {
      return new Degree('3');
    }

    if (quality === Qualities.MAJOR) {
      if (d === 7)
        return new Degree('7');
      else
        return new Degree('#' + d); // #11, #15
    } else {
      if ([3, 7].includes(d))
        return new Degree('b' + d); // b3, b7
      else
        return new Degree('11'); // There shouldn't be a 15!
    }
  }

  // See the static version of this method
  applyGenderToExtension(degree) {
    return Chord.applyGenderToExtension(degree, this.quality);
  }

  // Returns degrees with DegreeSource whomstdve purposes
  get degrees() {
    if (this.__degrees)
      return this.__degrees;

    let degrees = [];     // [Degree]

    // Go through all the chord tones
    for (let extension = 1; extension <= this.extension; extension += 2) {

      // XXX: Note that using if..else if may be an issue because
      // it is only assumed that alterations and removals might not
      // be of the same degree simultaneously
      if (this.removedNotes.filter(x => x.degree === extension).length !== 0) {
        // XXX: Naive implementation
        // Accidental part of a removed note's degree is ignored, still
        // unsure whether this will bring up any problems later on

        let noDeg = this.applyGenderToExtension(extension);
        noDeg.source = DegreeSource.NO;
        degrees.push(noDeg);
      } else if (extension === 3 && this.suspension !== SusMode.NONE) {
        // If the degree is the supended third, exclude the third by marking the
        // 3rd degree as SUSPENDED_THIRD, and replace the third with either
        // the 4th or 2nd depending on the specified suspension degree
        // denoted by the SUSPESION degree source.
        let susDeg = new Degree(
          this.suspension === SusMode.FOUR ? '4' : '2',
          DegreeSource.SUSPENSION);

        degrees.push(susDeg);
        degrees.push(new Degree('3', DegreeSource.SUSPENDED_THIRD));
      } else if (!this.alterations[extension]) {
        // Otherwise, if not altered, note is a normal chord tone
        // All the alterations will be added later, as some alterations
        // may not necessarily be included in the tertian stack
        // (e.g. the bb7 in a dom-5 dim chord)

        let normalDeg = this.applyGenderToExtension(extension);
        normalDeg.source = DegreeSource.QUALITY;
        degrees.push(normalDeg);
      }
    }

    // Add all the alterations

    for (let alterations of this.alterations) {
      if (!alterations || alterations.length === 0)
        continue;

      for (let d of alterations) {

        let source = DegreeSource.UNSPECIFIED;
        // Not all alterations may necessarily be included in the tertian stack
        // (The quasi-quality alterations may have excluded degrees)
        let included = d.degree <= this.extension;

        if (this.dimMode === DimMode.FULL && ['b3','b5','bb7'].includes(d.toString())) {
          source = DegreeSource.ALT_DIM;
        } else if (this.dimMode === DimMode.HALF && ['b3','b5'].includes(d.toString())) {
          source = DegreeSource.ALT_HDIM;
        } else if (this.aug && d.toString() === '#5') {
          source = DegreeSource.ALT_AUG;
        } else {
          source = DegreeSource.ALTERATION;
        }

        degrees.push(new Degree(d.toString(), source, included));
      }
    }

    // Add all the added notes... very simple

    for (let addDeg of this.addedNotes) {
      degrees.push(new Degree(addDeg.toString(), DegreeSource.ADDITION));
    }

    // done!

    this.__degrees = degrees;
    return this.__degrees;
  }

  // Represents the degrees and sources in string form
  degreesToString() {
    let str = '';
    let degrees = this.degrees;

    degrees.sort((a, b) => a.degree - b.degree + (a.accidentalClass - b.accidentalClass) * 0.1);

    for (let d of degrees.filter(x => x.included)) {
      switch(d.source) {
        case DegreeSource.QUALITY:
          str += d + ' ';
          break;
        case DegreeSource.ALTERATION:
          str += `alt-${d} `;
          break;
        case DegreeSource.ALT_AUG:
          str += `aug-${d} `;
          break;
        case DegreeSource.ALT_DIM:
          str += `dim-${d} `;
          break;
        case DegreeSource.ALT_HDIM:
          str += `hdim-${d} `;
          break;
        case DegreeSource.SUSPENSION:
          str += `sus-${d} `;
          break;
      }
    }

    str += '\n excl: ';
    for (let d of degrees.filter(x => !x.included)) {
      switch(d.source) {
        case DegreeSource.NO:
          str += `no-${d} `;
          break;
        case DegreeSource.SUSPENDED_THIRD:
          str += `no-${d}(sus) `;
          break;
        default:
          str += `excl-alt-${d} `;
          break;
      }
    }

    return str;
  }

  toString() {
    let str = this.root.toString() + ' ';

    switch(this.quality) {
      case Qualities.MAJOR:
        str += 'maj';
        break;
      case Qualities.MINOR:
        str += 'min';
        break;
      case Qualities.DOMINANT:
        str += 'dom';
        break;
    }

    str += `-${this.extension}`;

    for (let d of this.degrees.filter(x => x.source === DegreeSource.NO))
      str += ` no-${d.toString()}`;

    if (this.dimMode === DimMode.FULL) {
      str += ' dim';
    } else if (this.dimMode === DimMode.HALF) {
      str += ' hdim';
    }

    if (this.aug) {
      str += ' aug';
    }

    if (this.suspension === SusMode.FOUR) {
      str += ' sus4';
    } else if (this.suspension === SusMode.TWO) {
      str += ' sus2';
    }

    for (let d of this.degrees.filter(x => x.source === DegreeSource.ALTERATION))
      str += ' ' + d;

    for (let d of this.degrees.filter(x => x.source === DegreeSource.ADDITION))
      str += ` add-${d.toString()}`;

    return str;
  }

  // Returns an array of [Degree, Note] tuples
  // Note that excluded degrees will not be returned!
  // Use this for the actual chord notes
  construct(accidentalMode=DEFAULT_CHORD_ACCIDENTAL_MODE) {
    let out = [];

    for (let degree in this.degrees) {
      if (degree.included)
        out.push([degree, this.root.getInterval(degree.toString())]);
    }

    return out;
  }

  // Returns an array of [Degree, Note] tuples
  // Excluded degrees will also be returned with the Degree.included property set to false.
  // For only included (played) chord degrees, use construct() instead.
  constructWithExcluded(accidentalMode=DEFAULT_CHORD_ACCIDENTAL_MODE) {
    let out = [];

    for (let degree in this.degrees) {
      out.push([degree, this.root.getInterval(degree.toString())]);
    }

    return out;
  }
}
