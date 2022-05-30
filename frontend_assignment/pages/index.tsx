import detectEthereumProvider from "@metamask/detect-provider";
import { Strategy, ZkIdentity } from "@zk-kit/identity";
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols";
import { Contract, providers, utils } from "ethers";
import Head from "next/head";
import React from "react";
import {
  Box,
  TextField,
  ThemeProvider,
  createTheme,
  Stack,
  Button,
  Alert,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import styles from "../styles/Home.module.css";
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json";

//custom default message
yup.setLocale({
  number: {
    min: "Must be ${min}",
    max: "Must be less than ${max}",
    positive: "Must be positive",
    integer: "Must be an integer",
  },
});

// schema to validate  form inputs against
const schema = yup
  .object({
    firstName: yup.string().required("First Name required"),
    lastName: yup.string().required("Last Name required"),
    age: yup
      .number()
      .typeError("Valid number")
      .min(18)
      .max(99)
      .positive()
      .integer()
      .required("Age required"),
    address: yup
      .object()
      .shape({
        houseNumber: yup
          .number()
          .typeError("Valid number")
          .positive()
          .integer()
          .required("House Number required"),
        street: yup.string().required("Street required"),
        city: yup.string().required("City required"),
        state: yup.string().required("State required"),
        zip: yup
          .number()
          .typeError("Valid number")
          .positive()
          .integer()
          .required("Zip Code required"),
      })
      .required(),
  })
  .required();

//generate typescript interface
interface Person extends yup.InferType<typeof schema> {}

const defaultValues: Person = {
  firstName: "",
  lastName: "",
  age: 0,
  address: {
    houseNumber: "",
    street: "",
    city: "",
    state: "",
    zip: "",
  },
};

//change MUI theme to dark
const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

//patterns to test form inputs against
const alphaRegex = /^[A-Za-z]+$/i;
const numberRegex = /^\d+$/i;

export default function Home() {
  const [logs, setLogs] = React.useState("Connect your wallet and greet!");
  const [greeting, setGreeting] = React.useState(""); //greeting state
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Person>({
    defaultValues,
    resolver: yupResolver(schema),
  }); //use yup as the resolver

  //listen for event from contract and set greeting when event received
  // and on unmount, remove all listeners
  React.useEffect(() => {
    let ethersProvider: any = null;
    let contract: any = null;
    const listenEvent = async () => {
      const provider = (await detectEthereumProvider()) as any;

      await provider.request({ method: "eth_requestAccounts" });
      ethersProvider = new providers.Web3Provider(provider);
      contract = new Contract(
        "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        Greeter.abi,
        ethersProvider
      );
      //listening to NewGreeting event and setting the greeting
      contract.on("NewGreeting", (greeting: any, event: any) => {
        setGreeting(utils.toUtf8String(greeting)); //convert to utf string
      });
    };
    listenEvent();
    return () => {
      contract?.removeAllListeners(); //remove listeners
    };
  }, []);

  async function greet(data: Person) {
    setLogs("Creating your Semaphore identity...");

    const provider = (await detectEthereumProvider()) as any;

    await provider.request({ method: "eth_requestAccounts" });
    const ethersProvider = new providers.Web3Provider(provider);
    const signer = ethersProvider.getSigner();
    const message = await signer.signMessage(
      "Sign this message to create your identity!"
    );

    const identity = new ZkIdentity(Strategy.MESSAGE, message);
    const identityCommitment = identity.genIdentityCommitment();
    const identityCommitments = await (
      await fetch("./identityCommitments.json")
    ).json();

    const merkleProof = generateMerkleProof(
      20,
      BigInt(0),
      identityCommitments,
      identityCommitment
    );

    setLogs("Creating your Semaphore proof...");

    const greeting = "Hello world";

    const witness = Semaphore.genWitness(
      identity.getTrapdoor(),
      identity.getNullifier(),
      merkleProof,
      merkleProof.root,
      greeting
    );

    const { proof, publicSignals } = await Semaphore.genProof(
      witness,
      "./semaphore.wasm",
      "./semaphore_final.zkey"
    );
    const solidityProof = Semaphore.packToSolidityProof(proof);

    const response = await fetch("/api/greet", {
      method: "POST",
      body: JSON.stringify({
        greeting,
        nullifierHash: publicSignals.nullifierHash,
        solidityProof: solidityProof,
      }),
    });

    if (response.status === 500) {
      const errorMessage = await response.text();

      setLogs(errorMessage);
    } else {
      console.log(JSON.stringify(data));
      setLogs("Your anonymous greeting is onchain :)");
    }
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <div className={styles.container}>
        <Head>
          <title>Greetings</title>
          <meta
            name="description"
            content="A simple Next.js/Hardhat privacy application with Semaphore."
          />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <main className={styles.main}>
          <h1 className={styles.title}>Greetings</h1>

          <p className={styles.description}>
            A simple Next.js/Hardhat privacy application with Semaphore.
          </p>

          <div className={styles.logs}>{logs}</div>
          <Box>
            {!greeting ? (
              <form onSubmit={handleSubmit(greet)}>
                <Stack spacing={2} flex={1} alignItems="center">
                  <Stack direction="row" spacing={2}>
                    <Box>
                      <Controller
                        name="firstName"
                        control={control}
                        render={({ field: { onChange, onBlur, value } }) => (
                          <TextField
                            value={value}
                            onChange={onChange}
                            onBlur={onBlur}
                            label="First Name"
                            inputProps={{ "aria-label": "First Name" }}
                          />
                        )}
                      />
                      {errors.firstName && (
                        <Alert variant="outlined" severity="error">
                          {errors.firstName?.message}
                        </Alert>
                      )}
                    </Box>

                    <Box>
                      <Controller
                        name="lastName"
                        control={control}
                        render={({ field: { onChange, value } }) => (
                          <TextField
                            value={value}
                            onChange={onChange}
                            label="Last Name"
                            inputProps={{ "aria-label": "Last Name" }}
                          />
                        )}
                        rules={{
                          pattern: {
                            value: alphaRegex,
                            message: "Enter valid last name",
                          },
                          maxLength: 20,
                          required: "Last Name required",
                        }}
                      />
                      {errors.lastName && (
                        <Alert variant="outlined" severity="error">
                          {errors.lastName.message}
                        </Alert>
                      )}
                    </Box>

                    <Box>
                      <Controller
                        name="age"
                        control={control}
                        render={({ field: { onChange, onBlur, value } }) => (
                          <TextField
                            value={value}
                            onChange={onChange}
                            onBlur={onBlur}
                            label="Age"
                            type="number"
                            inputProps={{ "aria-label": "age" }}
                          />
                        )}
                        rules={{
                          min: {
                            value: 18,
                            message: "Age should be atleast 18",
                          },
                          max: {
                            value: 99,
                            message: "Age should be less than 100",
                          },
                          required: "Age required",
                        }}
                      />
                      {errors.age && (
                        <Alert variant="outlined" severity="error">
                          {errors.age.message}
                        </Alert>
                      )}
                    </Box>
                  </Stack>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={2}>
                      <Box>
                        <Controller
                          name="address.houseNumber"
                          control={control}
                          render={({ field: { onChange, onBlur, value } }) => (
                            <TextField
                              value={value}
                              onChange={onChange}
                              onBlur={onBlur}
                              label="House Number"
                              type="number"
                              inputProps={{ "aria-label": "house number" }}
                            />
                          )}
                          rules={{
                            pattern: {
                              value: numberRegex,
                              message: "Enter valid house number",
                            },
                            required: "House Number required",
                          }}
                        />
                        {errors.address?.houseNumber && (
                          <Alert variant="outlined" severity="error">
                            {errors.address?.houseNumber.message}
                          </Alert>
                        )}
                      </Box>
                      <Box flex={1}>
                        <Controller
                          name="address.street"
                          control={control}
                          render={({ field: { onChange, onBlur, value } }) => (
                            <TextField
                              value={value}
                              onChange={onChange}
                              onBlur={onBlur}
                              fullWidth
                              label="Street"
                              inputProps={{ "aria-label": "street" }}
                            />
                          )}
                          rules={{
                            pattern: {
                              value: alphaRegex,
                              message: "Enter valid street address",
                            },
                            required: "Street required",
                          }}
                        />
                        {errors.address?.street && (
                          <Alert variant="outlined" severity="error">
                            {errors.address?.street.message}
                          </Alert>
                        )}
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={2}>
                      <Box>
                        <Controller
                          name="address.city"
                          control={control}
                          render={({ field: { onChange, onBlur, value } }) => (
                            <TextField
                              value={value}
                              onChange={onChange}
                              onBlur={onBlur}
                              label="City"
                              inputProps={{ "aria-label": "city" }}
                            />
                          )}
                          rules={{
                            pattern: {
                              value: alphaRegex,
                              message: "Enter valid city",
                            },
                            required: "City required",
                          }}
                        />
                        {errors.address?.city && (
                          <Alert variant="outlined" severity="error">
                            {errors.address?.city.message}
                          </Alert>
                        )}
                      </Box>
                      <Box>
                        <Controller
                          name="address.state"
                          control={control}
                          render={({ field: { onChange, onBlur, value } }) => (
                            <TextField
                              value={value}
                              onChange={onChange}
                              onBlur={onBlur}
                              label="State"
                              inputProps={{ "aria-label": "state" }}
                            />
                          )}
                          rules={{
                            pattern: {
                              value: alphaRegex,
                              message: "Enter valid state",
                            },
                            required: "State required",
                          }}
                        />
                        {errors.address?.state && (
                          <Alert variant="outlined" severity="error">
                            {errors.address?.state.message}
                          </Alert>
                        )}
                      </Box>
                      <Box>
                        <Controller
                          name="address.zip"
                          control={control}
                          render={({ field: { onChange, onBlur, value } }) => (
                            <TextField
                              value={value}
                              onChange={onChange}
                              onBlur={onBlur}
                              label="Zip"
                              type="number"
                              inputProps={{ "aria-label": "zip" }}
                            />
                          )}
                          rules={{
                            pattern: {
                              value: numberRegex,
                              message: "Enter valid zip code",
                            },
                            required: "Zip required",
                          }}
                        />
                        {errors.address?.zip && (
                          <Alert variant="outlined" severity="error">
                            {errors.address?.zip.message}
                          </Alert>
                        )}
                      </Box>
                    </Stack>
                  </Stack>
                  <Button
                    type="submit"
                    size="large"
                    variant="contained"
                    sx={{ width: 1 / 2 }}
                  >
                    Greet
                  </Button>
                </Stack>
              </form>
            ) : (
              <Box mt={2} justifyContent="center">
                <TextField
                  id="outlined-basic"
                  label="Greeting"
                  variant="outlined"
                  InputProps={{
                    readOnly: true,
                  }}
                  value={greeting}
                />
              </Box>
            )}
          </Box>
        </main>
      </div>
    </ThemeProvider>
  );
}
