//TODO: Import necessary libraries. Check cargo.toml and the documentation of the libraries.
extern crate ark_bls12_381;
extern crate nalgebra as na;
extern crate ndarray;

use ark_bls12_381::fq::Fq;
use na::{DMatrix, DVector};
use rand::thread_rng;
use rand::Rng;

struct Freivald {
    x: DVector<Fq>, // Array/Vec of Fq,
}

impl Freivald {
    // TODO: Create constructor for object
    fn new(array_size: usize) -> Self {
        // Generate random number
        // Populate vector with values r^i for i=0..matrix_size
        // Return freivald value with this vector as its x value
        let mut rng = thread_rng(); // lazily-initialized thread-local random number generator
                                    // fill a vector with random numbers
        let random_numbers: Vec<Fq> = (0..array_size)
            .map(|_| Fq::from(rng.gen::<u64>()))
            .collect();
        // use the above vector to fill the Freivald structure x value
        let freivald = Freivald {
            x: DVector::from_vec(random_numbers),
        };

        return freivald;
    }

    // TODO: Add proper types to input matrices. Remember matrices should hold Fq values
    fn verify(
        &self,
        matrix_a: &DMatrix<Fq>,    // reference of matrixA
        matrix_b: &DMatrix<Fq>,    // reference of matrixB
        supposed_ab: &DMatrix<Fq>, // reference of matrixAB
    ) -> bool {
        assert!(check_matrix_dimensions(matrix_a, matrix_b, supposed_ab));
        // TODO: check if a * b * x == c * x. Check algorithm to make sure order of operations are
        // correct
        let bx = matrix_b * &self.x; // b*x
        let lhs = matrix_a * bx; // a*(b*x)
        let rhs = supposed_ab * &self.x; // c*x
        return lhs == rhs;
    }

    // utility function to not have to instantiate Freivalds if you just want to make one
    // verification.
    // TODO: Add types for arguments
    fn verify_once(
        matrix_a: &DMatrix<Fq>,
        matrix_b: &DMatrix<Fq>,
        supposed_ab: &DMatrix<Fq>,
    ) -> bool {
        let freivald = Freivald::new(supposed_ab.nrows());
        freivald.verify(matrix_a, matrix_b, supposed_ab)
    }
}
// TODO: [Bonus] Modify code to increase your certainty that A * B == C by iterating over the protocol.
// Note that you need to generate new vectors for new iterations or you'll be recomputing same
// value over and over. No problem in changing data structures used by the algorithm (currently its a struct
// but that can change if you want to)

// You can either do a test on main or just remove main function and rename this file to lib.rs to remove the
// warning of not having a main implementation
// fn main() {
//     todo!()
// }

// TODO: Add proper types to input matrices. Remember matrices should hold Fq values
pub fn check_matrix_dimensions(
    matrix_a: &DMatrix<Fq>,
    matrix_b: &DMatrix<Fq>,
    supposed_ab: &DMatrix<Fq>,
) -> bool {
    // TODO: Check if dimensions of making matrix_a * matrix_b matches values in supposed_ab.
    // If it doesn't you know its not the correct result independently of matrix contents
    return matrix_a.nrows() == matrix_b.ncols()
        && matrix_a.ncols() == matrix_b.nrows()
        && matrix_a.nrows() == supposed_ab.nrows()
        && matrix_b.ncols() == supposed_ab.ncols();
}

pub fn mat_product(matrix: &DMatrix<Fq>) -> DMatrix<Fq> {
    matrix * matrix
}

#[cfg(test)]
mod tests {
    // #[macro_use]
    use lazy_static::lazy_static;
    use rstest::rstest;

    use super::*;
    lazy_static! {
        static ref MATRIX_A: DMatrix<Fq> = DMatrix::<Fq>::from_element(200, 200, 1.into());
        static ref MATRIX_A_DOT_A: DMatrix<Fq> = mat_product(&MATRIX_A);
        static ref MATRIX_B: DMatrix<Fq> = DMatrix::<Fq>::from_element(200, 200, 2.into());
        static ref MATRIX_B_DOT_B: DMatrix<Fq> = mat_product(&MATRIX_B);
        static ref MATRIX_C: DMatrix<Fq> = DMatrix::<Fq>::from_element(200, 200, 3.into());
        static ref MATRIX_C_DOT_C: DMatrix<Fq> = mat_product(&MATRIX_C);
    }

    #[rstest]
    #[case(&MATRIX_A, &MATRIX_A, &MATRIX_A_DOT_A)]
    #[case(&MATRIX_B, &MATRIX_B, &MATRIX_B_DOT_B)]
    #[case(&MATRIX_C, &MATRIX_C, &MATRIX_C_DOT_C)]
    fn freivald_verify_success_test(
        #[case] matrix_a: &DMatrix<Fq>, /* Type of matrix. Values should be fq */
        #[case] matrix_b: &DMatrix<Fq>, /* Type of matrix. Values should be fq */
        #[case] supposed_ab: &DMatrix<Fq>, /* Type of matrix. Values should be fq */
    ) {
        let freivald = Freivald::new(supposed_ab.nrows());
        assert!(freivald.verify(matrix_a, matrix_b, supposed_ab));
    }

    #[rstest]
    #[case(&MATRIX_A, &MATRIX_B, &MATRIX_A_DOT_A)]
    #[case(&MATRIX_B, &MATRIX_A, &MATRIX_B_DOT_B)]
    #[case(&MATRIX_C, &MATRIX_B, &MATRIX_C_DOT_C)]
    fn freivald_verify_fail_test(
        #[case] a: &DMatrix<Fq>, /* Type of matrix. Values should be fq */
        #[case] b: &DMatrix<Fq>, /* Type of matrix. Values should be fq */
        #[case] c: &DMatrix<Fq>, /* Type of matrix. Values should be fq */
    ) {
        let freivald = Freivald::new(c.nrows());
        assert!(!freivald.verify(a, b, c));
    }
}
