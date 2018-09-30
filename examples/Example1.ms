// Example 1.
// This is just an example of (hopefully) valid (though not so useful) MiniScript 
// to test the highlighter

print("Hello world!")
someClass.member

for a in range(0, 360, 10)
	wait(1/36)
end for

print("We did something!")

// Not the world's greatest function ever
someFunction = function(message)
	while true
		print ("Printing forever: " + message)
		wait(0.01)
	end while
end function

someFunction("Forever")
