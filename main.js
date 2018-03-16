let $notes = {};

$(() => {
  $notes[1] = $notes.c = $('#note1');
  $notes[2] = $notes.g = $('#note2');
  $notes[3] = $notes.d = $('#note3');
  $notes[4] = $notes.a = $('#note4');
  $notes[5] = $notes.e = $('#note5');
  $notes[6] = $notes.b = $('#note6');
  $notes[7] = $notes.fs = $('#note7');
  $notes[8] = $notes.cs = $('#note8');
  $notes[9] = $notes.gs = $('#note9');
  $notes[10] = $notes.ds = $('#note10');
  $notes[11] = $notes.as = $('#note11');
  $notes[12] = $notes.f = $('#note12');


  adjustCircleContainerSize();

  // Initialize circle with C as root note
  positionCircle(1);

  $('.note').css({opacity: 1});

  // When note is clicked, make it the new root
  $('.note').click(function() {
    $note = $(this);
    let noteNo = $note.data('note');
    positionCircle(noteNo);
  });

});

function adjustCircleContainerSize() {
  let $c = $('.circle-container');
  if ($c.height() > $c.width()) {
    console.log('adjusted');
    $c.height($c.width());
  }
}

// Wraps the note numbers in a ring
// such that 12 => 12, 13 => 1, 14 => 2, etc...
function ring(noteNumber) {
  let x = (noteNumber - 1) % 12 + 1;
  if (x <= 0)
    x = 12 - x;

  return x;
}

function positionCircle(startingNoteNumber) {
  let containerWidth = $('.circle-container').width();
  let containerHeight = $('.circle-container').height();

  let diameter =
    (containerWidth < containerHeight ? containerWidth : containerHeight) * 0.8;

  let originX = containerWidth / 2.0;
  let originY = containerHeight / 2.0;

  let radius = diameter / 2;

  for(let i = 0; i < 12; i++) {
    let noteNo = ring(startingNoteNumber + i);
    let $note = $notes[noteNo];
    let top = originY - radius * Math.cos(2 * i / 12.0 * Math.PI) - $note.height() / 2;
    let left = originX + radius * Math.sin(2 * i / 12.0 * Math.PI) - $note.width() / 2;
    $note.css({top, left});
  }
}
