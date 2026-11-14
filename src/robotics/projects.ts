import {defaultWiring,type RoboticsProject} from './model';

export const lessons=[
  {id:'traffic',number:'01',name:'Traffic light',summary:'Sequence three outputs using simulated time.',
    challenge:'Change the green phase to 4 seconds. How would you add a flashing amber phase?',
    source:`# Traffic light · this program repeats forever
# D2 = red, D3 = amber, D4 = green
write D2 HIGH
write D3 LOW
write D4 LOW
wait 2000

write D2 LOW
write D4 HIGH
wait 3000

write D4 LOW
write D3 HIGH
wait 1000`},
  {id:'door',number:'02',name:'Automatic door',summary:'Use a distance sensor to move a servo.',
    challenge:'Move the distance slider below 35 cm to open the door. Change the threshold and test it again.',
    source:`# Automatic door · A0 = distance in centimeters
# D5 = servo, D4 = open indicator
if distance < 35
  servo D5 90
  write D4 HIGH
else
  servo D5 0
  write D4 LOW
end
wait 50`},
  {id:'obstacle',number:'03',name:'Obstacle detector',summary:'Combine a sensor and a button override.',
    challenge:'Bring an object within 30 cm, then press the button to override the warning. What happens at exactly 30 cm?',
    source:`# Obstacle detector · D0 = button override
if button == HIGH
  write D2 LOW
  write D4 HIGH
else
  if distance < 30
    write D2 HIGH
    write D4 LOW
  else
    write D2 LOW
    write D4 HIGH
  end
end
wait 50`},
] as const;

export function starterProject(id:string='traffic'):RoboticsProject{
  const lesson=lessons.find(l=>l.id===id)??lessons[0];
  return {version:1,lab:'robotics',name:lesson.name,lesson:lesson.id,source:lesson.source,wiring:{...defaultWiring}};
}
