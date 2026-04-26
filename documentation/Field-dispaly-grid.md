
## Field grid creation 
From the field_id partition type and path count is known.
*Logic for field grid*
if partition type is row
No of rows in display grid = path count
No of columns in display grid = 20

if partition type is column
No of rows in display grid = 20
No of columns in display grid = path count


## update field grid based on movement of robot
get only current path = integer value from user
if field type is row
grid position x = current path, y =0
if field type is column
grid position x = 0, y = current path

if field type is row, forward distance = convert length of field to centimeter 
if field type is column, forward distance = convert width of field to centimeter 


## update field grid based on movement of robot
when start weed detection clicked, run id and field id is known. 
send calculated forward distance and grid position to robot
use  Filed grid creation logic to construct grid using grey cells.

if partition type is row
distance of cell_metres = field_length_metres/20
No of steps to complete each cell = distance of cell_metres /camera_vision_width_metres
when number of robot update in weed detection = No of steps to complete each cell
if weed count<10 , color cell green
if weed count>10 but<20 , color cell orange
if weed count>20 , color cell red
then goto next cell in horizontal fashion

if partition type is column
distance of cell_metres = field_width_metres/20
No of steps to complete each cell = distance of cell /camera_vision_width_metres
when number of robot update in weed detection = 2 * No of steps to complete each cell
if weed count<10 , color cell green
if weed count>10 but<20 , color cell orange
if weed count>20 , color cell red
then goto next cell in vertical fashion

...and so on 


## dsiplay progress logic
detection in progress view, plot a has length of 500meter, camera vision width cm can fetched from devices table based on device id. 
### robot has to move 
 total steps = convert camera vision width cm to meters and divide by **field length** if partition type is **row**
 or 
 total steps = convert camera vision width cm to meters and divide by **field width** if partition type is **column**. 
Progress(%) = (current step/total steps)*100