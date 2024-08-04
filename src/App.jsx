import React, { useState, useEffect, useRef } from "react";
import {
  Container,
  Typography,
  Button,
  Paper,
  Box,
  Alert,
  AlertTitle,
  TextField,
} from "@mui/material";
import { Mic, MicOff, Calculate } from "@mui/icons-material";

const App = () => {
  const [result, setResult] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      console.error("Speech recognition not supported");
      setResult("Speech recognition not supported in this browser");
      return;
    }

    try {
      recognitionRef.current = new SpeechRecognition();

      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        const currentTranscript = Array.from(event.results)
          .map((result) => result[0])
          .map((result) => result.transcript)
          .join("");

        setTranscript(currentTranscript);
        processCommand(currentTranscript);
      };
    } catch (error) {
      console.error("Error initializing speech recognition:", error);
      setResult("Error initializing speech recognition");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  if (!isSupported) {
    return (
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ mt: 4, p: 4 }}>
          <Typography variant="h6">
            Sorry, speech recognition is not supported in this browser.
          </Typography>
          <Typography>
            Please try using a desktop browser like Chrome or Edge.
          </Typography>
        </Paper>
      </Container>
    );
  }

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
    setIsListening(!isListening);
  };

  const processCommand = (command) => {
    if (command.toLowerCase().includes("")) {
      let expression = command
        .toLowerCase()
        .replace(/^.*calculate/, "")
        .trim();
      expression = convertSpokenPunctuation(expression);
      try {
        let calculatedResult;
        if (expression.includes("=") || /[a-z]/i.test(expression)) {
          calculatedResult = calculateExpression(expression);
        } else {
          calculatedResult = evaluateSimpleExpression(expression);
        }
        setResult(calculatedResult.toString());
      } catch (error) {
        setResult("Error in calculation: " + error.message);
      }
    }
  };

  const evaluateSimpleExpression = (expr) => {
    // Remove spaces
    expr = expr.replace(/\s+/g, "");
    // Use a safer evaluation method
    return Number(Function('"use strict";return (' + expr + ")")());
  };

  const convertSpokenPunctuation = (expr) => {
    return expr
      .replace(/\bopen\b/gi, "(")
      .replace(/\bclose\b/gi, ")")
      .replace(/plus/gi, "+")
      .replace(/minus/gi, "-")
      .replace(/times/gi, "*")
      .replace(/multiplied by/gi, "*")
      .replace(/divided by/gi, "/")
      .replace(/equals/gi, "=")
      .replace(/equals to/gi, "=");
  };

  const calculateExpression = (expression) => {
    // Check if it's an equation
    if (expression.includes("=")) {
      return solveEquation(expression);
    } else {
      // For algebraic expressions without '=', use our custom evaluator
      const result = evaluateExpression(expression);
      return `Result: ${result.coefficient}x + ${result.constant}`;
    }
  };

  const solveEquation = (equation) => {
    const [side1, side2] = equation.split("=").map((side) => side.trim());

    // Check which side contains the variable
    const variableSide = side1.match(/[a-z]/i) ? side1 : side2;
    const constantSide = variableSide === side1 ? side2 : side1;

    const variable = variableSide.match(/[a-z]/i)[0];

    // Move all terms to the left side
    const fullExpression = `(${variableSide}) - (${constantSide})`;

    // Use our custom evaluator to simplify the expression
    const simplifiedExpression = evaluateExpression(fullExpression);

    // Solve for the variable
    const solution =
      -simplifiedExpression.constant / simplifiedExpression.coefficient;

    return `${variable} = ${solution}`;
  };

  const evaluateExpression = (expr) => {
    // Remove spaces
    expr = expr.replace(/\s+/g, "");

    const tokens = tokenize(expr);
    const output = shuntingYard(tokens);
    return evaluateRPN(output);
  };

  const tokenize = (expr) => {
    const regex = /([a-z]|\d+\.?\d*|\+|\-|\*|\/|\(|\))/gi;
    return expr.match(regex);
  };

  const shuntingYard = (tokens) => {
    const output = [];
    const operators = [];
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 };

    for (let token of tokens) {
      if (!isNaN(token)) {
        output.push(parseFloat(token));
      } else if (token.match(/[a-z]/i)) {
        output.push(token);
      } else if (token === "(") {
        operators.push(token);
      } else if (token === ")") {
        while (operators.length && operators[operators.length - 1] !== "(") {
          output.push(operators.pop());
        }
        operators.pop(); // Remove '('
      } else {
        while (
          operators.length &&
          precedence[operators[operators.length - 1]] >= precedence[token]
        ) {
          output.push(operators.pop());
        }
        operators.push(token);
      }
    }

    while (operators.length) {
      output.push(operators.pop());
    }

    return output;
  };

  const evaluateRPN = (tokens) => {
    const stack = [];
    let coefficient = 0;
    let constant = 0;

    for (let token of tokens) {
      if (typeof token === "number") {
        stack.push({ coefficient: 0, constant: token });
      } else if (token.match(/[a-z]/i)) {
        stack.push({ coefficient: 1, constant: 0 });
      } else {
        const b = stack.pop();
        const a = stack.pop();
        switch (token) {
          case "+":
            stack.push({
              coefficient: a.coefficient + b.coefficient,
              constant: a.constant + b.constant,
            });
            break;
          case "-":
            stack.push({
              coefficient: a.coefficient - b.coefficient,
              constant: a.constant - b.constant,
            });
            break;
          case "*":
            stack.push({
              coefficient:
                a.coefficient * b.constant + b.coefficient * a.constant,
              constant: a.constant * b.constant,
            });
            break;
          case "/":
            if (b.coefficient !== 0) {
              throw new Error("Cannot divide by a variable");
            }
            stack.push({
              coefficient: a.coefficient / b.constant,
              constant: a.constant / b.constant,
            });
            break;
        }
      }
    }

    return stack[0];
  };

  return (
    <Container
      maxWidth="sm"
      sx={{
        backgroundImage: `url('https://img.freepik.com/free-vector/seamless-pattern-with-school-office-stationery_107791-9568.jpg?t=st=1722737004~exp=1722740604~hmac=2f3ad6e11707c29e7fdbc4b0ec0d776c820780cc9c969928147219332f9adccd&w=740')`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        minHeight: "100vh",
        padding: "20px",
      }}
    >
      <Paper
        elevation={3}
        sx={{ mt: 4, p: 4, backgroundColor: "rgba(255, 255, 255, 0.9)" }}
      >
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          mb={3}
        >
          <Typography variant="h5" fontWeight={"bold"} gutterBottom>
            EWUSCO TALKING CALCULATOR
          </Typography>
          <Calculate fontSize="large" color="primary" />
        </Box>

        <Alert severity="info" sx={{ mb: 1 }}>
          <AlertTitle>How to use:</AlertTitle>
          Example: "2 plus 3" or "calculate x plus 3 equals 5"
        </Alert>

        <Button
          variant="contained"
          color={isListening ? "error" : "primary"}
          startIcon={isListening ? <MicOff /> : <Mic />}
          onClick={toggleListening}
          fullWidth
          sx={{ mb: 1 }}
        >
          {isListening ? "Stop Listening" : "Start Listening"}
        </Button>

        <Typography variant="h6" gutterBottom>
          Status:
        </Typography>
        <Alert severity={isListening ? "success" : "error"} sx={{ mb: 1 }}>
          {isListening ? "Listening" : "Not Listening"}
        </Alert>

        <Typography variant="h6" gutterBottom>
          Transcript:
        </Typography>
        <TextField
          value={transcript || "No speech detected yet"}
          fullWidth
          multiline
          variant="outlined"
          InputProps={{ readOnly: true }}
          sx={{ mb: 1 }}
        />

        <Typography variant="h6" gutterBottom>
          Result:
        </Typography>
        <TextField
          value={result || "No calculation performed yet"}
          fullWidth
          variant="outlined"
          InputProps={{ readOnly: true }}
        />
      </Paper>
    </Container>
  );
};

export default App;
